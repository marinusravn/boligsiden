const App = {
  listings: [],
  accounts: [],
  filtered: [],

  async init() {
    const basePaths = ['', '../'];
    for (const base of basePaths) {
      try {
        const [listingsRes, accountsRes] = await Promise.all([
          fetch(base + 'data/listings.json').then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }),
          fetch(base + 'data/accounts.json').then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
        ]);
        this.listings = listingsRes;
        this.accounts = accountsRes;
        this._basePath = base;

        // Merge user-added listings from localStorage
        const userListings = JSON.parse(localStorage.getItem('bg_user_listings') || '[]');
        if (userListings.length) {
          const existingIds = new Set(this.listings.map(l => l.listing_id));
          for (const ul of userListings) {
            if (!existingIds.has(ul.listing_id)) {
              this.listings.push(ul);
            }
          }
        }

        this.filtered = [...this.listings];
        return;
      } catch (e) {
        continue;
      }
    }
    if (window.__LISTINGS__) this.listings = window.__LISTINGS__;
    if (window.__ACCOUNTS__) this.accounts = window.__ACCOUNTS__;

    const userListings = JSON.parse(localStorage.getItem('bg_user_listings') || '[]');
    if (userListings.length) {
      const existingIds = new Set(this.listings.map(l => l.listing_id));
      for (const ul of userListings) {
        if (!existingIds.has(ul.listing_id)) {
          this.listings.push(ul);
        }
      }
    }

    this.filtered = [...this.listings];
    this._basePath = '';
  },

  formatPrice(price) {
    if (!price) return null;
    return new Intl.NumberFormat('da-DK').format(price) + ' DKK';
  },

  formatDate(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  },

  getUniqueValues(field) {
    const values = new Set();
    this.listings.forEach(l => {
      if (l[field]) values.add(l[field]);
    });
    return [...values].sort();
  },

  getListingsWithPrice() {
    return this.listings.filter(l => l.price_dkk != null);
  },

  getListingsWithArea() {
    return this.listings.filter(l => (l.approximate_area_sqm ?? l.area_m2) != null);
  },

  getArea(l) {
    return l.approximate_area_sqm ?? l.area_m2 ?? null;
  },

  getAllFeatures() {
    const counts = {};
    this.listings.forEach(l => {
      (l.features || []).forEach(f => {
        counts[f] = (counts[f] || 0) + 1;
      });
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  },

  matchesSearch(listing, query) {
    if (!query) return true;
    const q = query.toLowerCase();
    const fields = [
      listing.street_name, listing.house_number, listing.neighborhood,
      listing.city, listing.postal_code, listing.brokerage_name,
      listing.post_caption_raw, listing.property_type,
      listing.floor_or_unit, listing.floor,
    ];
    const tl = listing.tinglysning;
    if (tl) {
      (tl.owners || []).forEach(o => fields.push(o.name));
      fields.push(tl.property_type_tl, tl.matrikel, tl.landsejerlav, tl.municipality);
    }
    (listing.features || []).forEach(f => fields.push(f));
    const haystack = fields.filter(Boolean).join(' ').toLowerCase();
    return q.split(/\s+/).every(word => haystack.includes(word));
  },

  applyFilters(filters) {
    this.filtered = this.listings.filter(l => {
      if (filters.searchQuery && !this.matchesSearch(l, filters.searchQuery)) return false;
      if (filters.neighborhood && l.neighborhood !== filters.neighborhood) return false;
      if (filters.city && l.city !== filters.city) return false;
      if (filters.minPrice != null && (l.price_dkk == null || l.price_dkk < filters.minPrice)) return false;
      if (filters.maxPrice != null && (l.price_dkk == null || l.price_dkk > filters.maxPrice)) return false;
      const area = this.getArea(l);
      if (filters.minArea != null && (area == null || area < filters.minArea)) return false;
      if (filters.maxArea != null && (area == null || area > filters.maxArea)) return false;
      if (filters.propertyType && l.property_type !== filters.propertyType) return false;
      if (filters.minRooms != null && (l.rooms == null || l.rooms < filters.minRooms)) return false;
      if (filters.maxRooms != null && (l.rooms == null || l.rooms > filters.maxRooms)) return false;
      if (filters.brokerage && l.brokerage_name !== filters.brokerage) return false;
      if (filters.onlyWithPrice && l.price_dkk == null) return false;
      if (filters.onlyWithArea && this.getArea(l) == null) return false;
      const feats = l.features || [];
      if (filters.features && filters.features.length > 0) {
        for (const f of filters.features) {
          if (!feats.includes(f)) return false;
        }
      }
      return true;
    });
  },

  sortListings(sortBy) {
    const sorters = {
      'newest': (a, b) => new Date(b.post_date || 0) - new Date(a.post_date || 0),
      'oldest': (a, b) => new Date(a.post_date || 0) - new Date(b.post_date || 0),
      'price-asc': (a, b) => (a.price_dkk || Infinity) - (b.price_dkk || Infinity),
      'price-desc': (a, b) => (b.price_dkk || 0) - (a.price_dkk || 0),
      'area-asc': (a, b) => (this.getArea(a) || Infinity) - (this.getArea(b) || Infinity),
      'area-desc': (a, b) => (this.getArea(b) || 0) - (this.getArea(a) || 0)
    };
    if (sorters[sortBy]) {
      this.filtered.sort(sorters[sortBy]);
    }
  },

  getInstagramEmbedHtml(shortcode) {
    if (!shortcode) return '';
    return `<blockquote class="instagram-media ig-embed-card" data-instgrm-permalink="https://www.instagram.com/p/${shortcode}/" data-instgrm-version="14"><a href="https://www.instagram.com/p/${shortcode}/" target="_blank" rel="noopener">View post on Instagram</a></blockquote>`;
  },

  loadInstagramEmbed() {
    if (window._igEmbedLoaded) return;
    window._igEmbedLoaded = true;
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.instagram.com/embed.js';
    document.body.appendChild(s);
  },

  reprocessEmbeds() {
    if (window.instgrm && window.instgrm.Embeds) {
      window.instgrm.Embeds.process();
    }
  },

  getInstagramLink(listing) {
    if (listing.instagram_shortcode) {
      return `https://www.instagram.com/p/${listing.instagram_shortcode}/`;
    }
    return listing.instagram_post_url || listing.source_account_url;
  },

  hasDirectPost(listing) {
    return !!listing.instagram_shortcode;
  },

  renderCard(listing) {
    const price = this.formatPrice(listing.price_dkk);
    const date = this.formatDate(listing.post_date);
    const isNew = listing.post_date && (new Date() - new Date(listing.post_date)) < 14 * 86400000;
    const hasOpenHouse = listing.open_house_date != null;
    const base = this._basePath || '';
    const isUserAdded = listing._userAdded;
    const detailUrl = isUserAdded ? '#' : base + 'listing/' + listing.listing_id + '.html';
    const hasEmbed = this.hasDirectPost(listing);

    let badges = '';
    if (isNew) badges += '<span class="badge badge-new">New</span>';
    if (isUserAdded) badges += '<span class="badge badge-new" style="background:#667eea;">User added</span>';
    if (hasOpenHouse) {
      const ohDate = new Date(listing.open_house_date);
      const ohStr = `${ohDate.getMonth() + 1}/${ohDate.getDate()}`;
      badges += `<span class="badge badge-open-house">Open house ${ohStr}</span>`;
    }
    if (listing.listing_status === 'sold' || listing.status === 'solgt') badges += '<span class="badge badge-sold">Sold</span>';

    const imageArea = hasEmbed
      ? `<div class="card-image card-image-embed">${this.getInstagramEmbedHtml(listing.instagram_shortcode)}<div class="card-badges">${badges}</div></div>`
      : `<div class="card-image"><span class="placeholder-icon">\u{1F3E0}</span><div class="card-badges">${badges}</div></div>`;

    const igLink = this.getInstagramLink(listing);
    const igLabel = hasEmbed ? 'View post' : 'View broker';

    const onClickAttr = isUserAdded
      ? `onclick="if(event.target.tagName!=='A'){window.open('${igLink}','_blank');}"`
      : `onclick="window.location.href='${detailUrl}'"`;

    return `
      <div class="listing-card" ${onClickAttr}>
        ${imageArea}
        <div class="card-body">
          <div class="card-price ${!price ? 'no-price' : ''}">${price || 'Price not listed'}</div>
          <div class="card-details">
            ${this.getArea(listing) ? `<span class="card-detail"><span class="detail-icon">\u{1F4CF}</span> ${this.getArea(listing)} m\u00B2</span>` : ''}
            ${listing.rooms ? `<span class="card-detail"><span class="detail-icon">\u{1F6AA}</span> ${listing.rooms} rooms</span>` : ''}
            ${listing.property_type ? `<span class="card-detail">${App.translatePropertyType(listing.property_type)}</span>` : ''}
          </div>
          <div class="card-address">${listing.street_name || ''} ${listing.house_number || ''}${(listing.floor_or_unit || listing.floor) ? ', ' + (listing.floor_or_unit || listing.floor) : ''}</div>
          <div class="card-neighborhood">${listing.postal_code || ''} ${listing.city || ''} \u2014 ${listing.neighborhood || ''}</div>
          ${(listing.features && listing.features.length > 0) ? `<div class="card-features">${listing.features.slice(0, 4).map(f => `<span class="feature-tag">${f}</span>`).join('')}${listing.features.length > 4 ? `<span class="feature-tag feature-more">+${listing.features.length - 4}</span>` : ''}</div>` : ''}
          ${listing.rating && listing.rating.overall_score ? `<div class="card-rating" onclick="event.stopPropagation(); window.location.href='${base}listing/${listing.listing_id}-rating.html';"><span class="card-rating-score" style="color:${App.scoreColor(listing.rating.overall_score)};">${listing.rating.overall_score}</span><span class="card-rating-label">${App.scoreLabel(listing.rating.overall_score)}</span><span class="card-rating-link">View rating &#8594;</span></div>` : ''}
          <div class="card-footer">
            <span class="card-broker">${listing.brokerage_name || ''}</span>
            <span class="card-date">${date || ''}</span>
          </div>
        </div>
      </div>
    `;
  },

  scoreColor(score) {
    if (!score) return '#999';
    if (score >= 4.0) return '#27ae60';
    if (score >= 3.0) return '#f5a623';
    return '#c0392b';
  },

  scoreLabel(score) {
    if (!score) return 'Not rated';
    if (score >= 4.5) return 'Excellent';
    if (score >= 4.0) return 'Very good';
    if (score >= 3.5) return 'Good';
    if (score >= 3.0) return 'Average';
    if (score >= 2.0) return 'Below average';
    return 'Low';
  },

  translatePropertyType(type) {
    const map = {
      'apartment': 'Apartment',
      'house': 'House',
      'villa': 'Villa',
      'townhouse': 'Townhouse',
      'penthouse': 'Penthouse',
      'unknown': 'Unknown'
    };
    return map[type] || type;
  },

  renderGrid(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (this.filtered.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">\u{1F50D}</div>
          <h3>No listings found</h3>
          <p>Try adjusting your filters to see more results.</p>
        </div>
      `;
      return;
    }
    container.innerHTML = this.filtered.map(l => this.renderCard(l)).join('');
    if (this.filtered.some(l => this.hasDirectPost(l))) {
      this.loadInstagramEmbed();
      setTimeout(() => this.reprocessEmbeds(), 500);
    }
  },

  updateResultCount(countId) {
    const el = document.getElementById(countId);
    if (el) {
      el.innerHTML = `Showing <strong>${this.filtered.length}</strong> ${this.filtered.length === 1 ? 'listing' : 'listings'}`;
    }
  },

  formatCompactPrice(val) {
    if (val >= 1000000) return (val / 1000000).toFixed(1).replace('.0', '') + 'M';
    if (val >= 1000) return Math.round(val / 1000) + 'k';
    return String(val);
  },

  setupRangeSlider(minId, maxId, fillId, labelId, formatFn) {
    const minEl = document.getElementById(minId);
    const maxEl = document.getElementById(maxId);
    const fillEl = document.getElementById(fillId);
    const labelEl = document.getElementById(labelId);
    if (!minEl || !maxEl) return;

    const update = () => {
      let lo = parseInt(minEl.value);
      let hi = parseInt(maxEl.value);
      if (lo > hi) { const tmp = lo; lo = hi; hi = tmp; minEl.value = lo; maxEl.value = hi; }
      const rangeMin = parseInt(minEl.min);
      const rangeMax = parseInt(minEl.max);
      const span = rangeMax - rangeMin || 1;
      const leftPct = ((lo - rangeMin) / span) * 100;
      const rightPct = ((hi - rangeMin) / span) * 100;
      if (fillEl) { fillEl.style.left = leftPct + '%'; fillEl.style.width = (rightPct - leftPct) + '%'; }
      if (labelEl && formatFn) {
        const atMin = lo === rangeMin;
        const atMax = hi === rangeMax;
        if (atMin && atMax) labelEl.textContent = '';
        else if (atMin) labelEl.textContent = '\u2014 ' + formatFn(hi);
        else if (atMax) labelEl.textContent = formatFn(lo) + ' \u2014';
        else labelEl.textContent = formatFn(lo) + ' \u2014 ' + formatFn(hi);
      }
      this.handleFilterChange();
    };

    minEl.addEventListener('input', update);
    maxEl.addEventListener('input', update);
    update();
  },

  populateFilters() {
    const setOptions = (id, values, labelFn) => {
      const el = document.getElementById(id);
      if (!el) return;
      const current = el.value;
      const firstOption = el.options[0];
      el.innerHTML = '';
      el.appendChild(firstOption);
      values.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v;
        opt.textContent = labelFn ? labelFn(v) : v;
        el.appendChild(opt);
      });
      if (current) el.value = current;
    };

    setOptions('filter-neighborhood', this.getUniqueValues('neighborhood'));
    setOptions('filter-city', this.getUniqueValues('city'));
    setOptions('filter-type', this.getUniqueValues('property_type'), this.translatePropertyType);
    setOptions('filter-brokerage', this.getUniqueValues('brokerage_name'));

    const prices = this.getListingsWithPrice().map(l => l.price_dkk);
    if (prices.length) {
      const pMin = Math.floor(Math.min(...prices) / 500000) * 500000;
      const pMax = Math.ceil(Math.max(...prices) / 500000) * 500000;
      const minP = document.getElementById('filter-min-price');
      const maxP = document.getElementById('filter-max-price');
      if (minP) { minP.min = pMin; minP.max = pMax; minP.value = pMin; }
      if (maxP) { maxP.min = pMin; maxP.max = pMax; maxP.value = pMax; }
    }

    const areas = this.getListingsWithArea().map(l => this.getArea(l));
    if (areas.length) {
      const aMin = Math.floor(Math.min(...areas) / 10) * 10;
      const aMax = Math.ceil(Math.max(...areas) / 10) * 10;
      const minA = document.getElementById('filter-min-area');
      const maxA = document.getElementById('filter-max-area');
      if (minA) { minA.min = aMin; minA.max = aMax; minA.value = aMin; }
      if (maxA) { maxA.min = aMin; maxA.max = aMax; maxA.value = aMax; }
    }

    const rooms = this.listings.map(l => l.rooms).filter(Boolean);
    if (rooms.length) {
      const rMin = Math.min(...rooms);
      const rMax = Math.max(...rooms);
      const minR = document.getElementById('filter-min-rooms');
      const maxR = document.getElementById('filter-max-rooms');
      if (minR) { minR.min = rMin; minR.max = rMax; minR.value = rMin; }
      if (maxR) { maxR.min = rMin; maxR.max = rMax; maxR.value = rMax; }
    }

    this.setupRangeSlider('filter-min-price', 'filter-max-price', 'price-range-fill', 'price-range-label', v => this.formatCompactPrice(v));
    this.setupRangeSlider('filter-min-area', 'filter-max-area', 'area-range-fill', 'area-range-label', v => v + ' m\u00B2');
    this.setupRangeSlider('filter-min-rooms', 'filter-max-rooms', 'rooms-range-fill', 'rooms-range-label', v => v + ' rooms');

    const features = this.getAllFeatures();
    for (let i = 1; i <= 3; i++) {
      const el = document.getElementById(`filter-feature-${i}`);
      if (!el) continue;
      const current = el.value;
      const firstOpt = el.options[0];
      el.innerHTML = '';
      el.appendChild(firstOpt);
      features.forEach(f => {
        const opt = document.createElement('option');
        opt.value = f.name;
        opt.textContent = `${f.name} (${f.count})`;
        el.appendChild(opt);
      });
      if (current) el.value = current;
    }
  },

  readFilters() {
    const features = [];
    for (let i = 1; i <= 3; i++) {
      const v = document.getElementById(`filter-feature-${i}`)?.value;
      if (v) features.push(v);
    }
    const minPriceEl = document.getElementById('filter-min-price');
    const maxPriceEl = document.getElementById('filter-max-price');
    const minAreaEl = document.getElementById('filter-min-area');
    const maxAreaEl = document.getElementById('filter-max-area');
    const minRoomsEl = document.getElementById('filter-min-rooms');
    const maxRoomsEl = document.getElementById('filter-max-rooms');

    const minPrice = minPriceEl ? parseInt(minPriceEl.value) : null;
    const maxPrice = maxPriceEl ? parseInt(maxPriceEl.value) : null;
    const minArea = minAreaEl ? parseInt(minAreaEl.value) : null;
    const maxArea = maxAreaEl ? parseInt(maxAreaEl.value) : null;
    const minRooms = minRoomsEl ? parseInt(minRoomsEl.value) : null;
    const maxRooms = maxRoomsEl ? parseInt(maxRoomsEl.value) : null;

    return {
      searchQuery: document.getElementById('search-input')?.value?.trim() || '',
      neighborhood: document.getElementById('filter-neighborhood')?.value || '',
      city: document.getElementById('filter-city')?.value || '',
      minPrice: (minPriceEl && minPrice > parseInt(minPriceEl.min)) ? minPrice : null,
      maxPrice: (maxPriceEl && maxPrice < parseInt(maxPriceEl.max)) ? maxPrice : null,
      minArea: (minAreaEl && minArea > parseInt(minAreaEl.min)) ? minArea : null,
      maxArea: (maxAreaEl && maxArea < parseInt(maxAreaEl.max)) ? maxArea : null,
      minRooms: (minRoomsEl && minRooms > parseInt(minRoomsEl.min)) ? minRooms : null,
      maxRooms: (maxRoomsEl && maxRooms < parseInt(maxRoomsEl.max)) ? maxRooms : null,
      propertyType: document.getElementById('filter-type')?.value || '',
      brokerage: document.getElementById('filter-brokerage')?.value || '',
      onlyWithPrice: document.getElementById('filter-only-price')?.checked || false,
      onlyWithArea: document.getElementById('filter-only-area')?.checked || false,
      features,
    };
  },

  handleFilterChange() {
    const filters = this.readFilters();
    this.applyFilters(filters);
    const sortEl = document.getElementById('sort-select');
    if (sortEl) this.sortListings(sortEl.value);
    this.renderGrid('listing-grid');
    this.updateResultCount('result-count');
  },

  setupListingsPage() {
    this.populateFilters();

    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      let debounce;
      searchInput.addEventListener('input', () => {
        clearTimeout(debounce);
        debounce = setTimeout(() => this.handleFilterChange(), 200);
      });
    }

    const filterEls = document.querySelectorAll('.filter-group select, .filter-checkbox input');
    filterEls.forEach(el => {
      el.addEventListener('change', () => this.handleFilterChange());
    });

    const sortEl = document.getElementById('sort-select');
    if (sortEl) {
      sortEl.addEventListener('change', () => {
        this.sortListings(sortEl.value);
        this.renderGrid('listing-grid');
      });
    }

    const resetBtn = document.getElementById('filter-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        document.querySelectorAll('.filter-group select').forEach(s => s.value = '');
        document.querySelectorAll('.filter-checkbox input').forEach(c => c.checked = false);
        document.querySelectorAll('.range-input').forEach(r => {
          if (r.classList.contains('range-input-min')) r.value = r.min;
          else r.value = r.max;
        });
        document.querySelectorAll('.range-fill').forEach(f => { f.style.left = '0%'; f.style.width = '100%'; });
        document.querySelectorAll('.range-values').forEach(l => l.textContent = '');
        this.filtered = [...this.listings];
        if (sortEl) {
          sortEl.value = 'newest';
          this.sortListings('newest');
        }
        this.renderGrid('listing-grid');
        this.updateResultCount('result-count');
      });
    }

    this.sortListings('newest');
    this.renderGrid('listing-grid');
    this.updateResultCount('result-count');
  },

  setupHomePage() {
    const statListings = document.getElementById('stat-listings');
    const statBrokers = document.getElementById('stat-brokers');
    const statPrice = document.getElementById('stat-price');
    const statArea = document.getElementById('stat-area');

    if (statListings) statListings.textContent = this.listings.length;
    if (statBrokers) {
      const brokers = new Set(this.listings.map(l => l.brokerage_name).filter(Boolean));
      statBrokers.textContent = brokers.size;
    }
    if (statPrice) {
      const withPrice = this.getListingsWithPrice().length;
      statPrice.textContent = this.listings.length > 0
        ? Math.round((withPrice / this.listings.length) * 100) + '%'
        : '0%';
    }
    if (statArea) {
      const withArea = this.getListingsWithArea().length;
      statArea.textContent = this.listings.length > 0
        ? Math.round((withArea / this.listings.length) * 100) + '%'
        : '0%';
    }

    this.sortListings('newest');
    const previewGrid = document.getElementById('preview-grid');
    if (previewGrid) {
      const preview = this.filtered.slice(0, 3);
      previewGrid.innerHTML = preview.map(l => this.renderCard(l)).join('');
      if (preview.some(l => this.hasDirectPost(l))) {
        this.loadInstagramEmbed();
        setTimeout(() => this.reprocessEmbeds(), 500);
      }
    }
  },

  extractShortcode(url) {
    if (!url) return null;
    const patterns = [
      /instagram\.com\/(?:p|reel|reels)\/([A-Za-z0-9_-]+)/,
      /instagram\.com\/tv\/([A-Za-z0-9_-]+)/,
    ];
    for (const p of patterns) {
      const m = url.match(p);
      if (m) return m[1];
    }
    return null;
  },

  addUserListing(data) {
    const userListings = JSON.parse(localStorage.getItem('bg_user_listings') || '[]');
    userListings.push(data);
    localStorage.setItem('bg_user_listings', JSON.stringify(userListings));
    const existingIds = new Set(this.listings.map(l => l.listing_id));
    if (!existingIds.has(data.listing_id)) {
      this.listings.push(data);
      this.filtered = [...this.listings];
    }
  }
};
