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
        this.filtered = [...this.listings];
        this._basePath = base;
        return;
      } catch (e) {
        continue;
      }
    }
    if (window.__LISTINGS__) this.listings = window.__LISTINGS__;
    if (window.__ACCOUNTS__) this.accounts = window.__ACCOUNTS__;
    this.filtered = [...this.listings];
    this._basePath = '';
  },

  formatPrice(price) {
    if (!price) return null;
    return new Intl.NumberFormat('da-DK').format(price) + ' kr.';
  },

  formatDate(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    const months = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
    return `${d.getDate()}. ${months[d.getMonth()]} ${d.getFullYear()}`;
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

  applyFilters(filters) {
    this.filtered = this.listings.filter(l => {
      if (filters.neighborhood && l.neighborhood !== filters.neighborhood) return false;
      if (filters.city && l.city !== filters.city) return false;
      if (filters.minPrice && (l.price_dkk == null || l.price_dkk < filters.minPrice)) return false;
      if (filters.maxPrice && (l.price_dkk == null || l.price_dkk > filters.maxPrice)) return false;
      const area = this.getArea(l);
      if (filters.minArea && (area == null || area < filters.minArea)) return false;
      if (filters.maxArea && (area == null || area > filters.maxArea)) return false;
      if (filters.propertyType && l.property_type !== filters.propertyType) return false;
      if (filters.rooms && l.rooms !== parseInt(filters.rooms)) return false;
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
    return `<blockquote class="instagram-media ig-embed-card" data-instgrm-permalink="https://www.instagram.com/p/${shortcode}/" data-instgrm-version="14"><a href="https://www.instagram.com/p/${shortcode}/" target="_blank" rel="noopener">Se opslaget p\u00E5 Instagram</a></blockquote>`;
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
    const detailUrl = base + 'listing/' + listing.listing_id + '.html';
    const hasEmbed = this.hasDirectPost(listing);

    let badges = '';
    if (isNew) badges += '<span class="badge badge-new">Nyhed</span>';
    if (hasOpenHouse) {
      const ohDate = new Date(listing.open_house_date);
      const ohStr = `${ohDate.getDate()}/${ohDate.getMonth() + 1}`;
      badges += `<span class="badge badge-open-house">\u00C5bent hus ${ohStr}</span>`;
    }
    if (listing.listing_status === 'sold' || listing.status === 'solgt') badges += '<span class="badge badge-sold">Solgt</span>';

    const imageArea = hasEmbed
      ? `<div class="card-image card-image-embed">${this.getInstagramEmbedHtml(listing.instagram_shortcode)}<div class="card-badges">${badges}</div></div>`
      : `<div class="card-image"><span class="placeholder-icon">\u{1F3E0}</span><div class="card-badges">${badges}</div></div>`;

    const igLink = this.getInstagramLink(listing);
    const igLabel = hasEmbed ? 'Se opslag' : 'Se m\u00E6gler';

    return `
      <div class="listing-card" onclick="window.location.href='${detailUrl}'">
        ${imageArea}
        <div class="card-body">
          <div class="card-price ${!price ? 'no-price' : ''}">${price || 'Pris ikke oplyst'}</div>
          <div class="card-details">
            ${this.getArea(listing) ? `<span class="card-detail"><span class="detail-icon">\u{1F4CF}</span> ${this.getArea(listing)} m\u00B2</span>` : ''}
            ${listing.rooms ? `<span class="card-detail"><span class="detail-icon">\u{1F6AA}</span> ${listing.rooms} rum</span>` : ''}
            ${listing.property_type ? `<span class="card-detail">${App.translatePropertyType(listing.property_type)}</span>` : ''}
          </div>
          <div class="card-address">${listing.street_name || ''} ${listing.house_number || ''}${(listing.floor_or_unit || listing.floor) ? ', ' + (listing.floor_or_unit || listing.floor) : ''}</div>
          <div class="card-neighborhood">${listing.postal_code || ''} ${listing.city || ''} \u2014 ${listing.neighborhood || ''}</div>
          ${(listing.features && listing.features.length > 0) ? `<div class="card-features">${listing.features.slice(0, 4).map(f => `<span class="feature-tag">${f}</span>`).join('')}${listing.features.length > 4 ? `<span class="feature-tag feature-more">+${listing.features.length - 4}</span>` : ''}</div>` : ''}
          <div class="card-footer">
            <span class="card-broker">${listing.brokerage_name || ''}</span>
            <span class="card-date">${date || ''}</span>
          </div>
        </div>
      </div>
    `;
  },

  translatePropertyType(type) {
    const map = {
      'apartment': 'Lejlighed',
      'house': 'Hus',
      'villa': 'Villa',
      'townhouse': 'R\u00E6kkehus',
      'penthouse': 'Penthouse',
      'unknown': 'Ukendt'
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
          <h3>Ingen boliger fundet</h3>
          <p>Pr\u00F8v at justere dine filtre for at se flere resultater.</p>
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
      el.innerHTML = `Viser <strong>${this.filtered.length}</strong> ${this.filtered.length === 1 ? 'bolig' : 'boliger'}`;
    }
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

    const rooms = [...new Set(this.listings.map(l => l.rooms).filter(Boolean))].sort((a, b) => a - b);
    setOptions('filter-rooms', rooms, v => v + ' rum');

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
    return {
      neighborhood: document.getElementById('filter-neighborhood')?.value || '',
      city: document.getElementById('filter-city')?.value || '',
      minPrice: parseInt(document.getElementById('filter-min-price')?.value) || null,
      maxPrice: parseInt(document.getElementById('filter-max-price')?.value) || null,
      minArea: parseInt(document.getElementById('filter-min-area')?.value) || null,
      maxArea: parseInt(document.getElementById('filter-max-area')?.value) || null,
      propertyType: document.getElementById('filter-type')?.value || '',
      rooms: document.getElementById('filter-rooms')?.value || '',
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

    const filterEls = document.querySelectorAll('.filter-group select, .filter-group input[type="number"], .filter-checkbox input');
    filterEls.forEach(el => {
      el.addEventListener('change', () => this.handleFilterChange());
      if (el.type === 'number') {
        el.addEventListener('input', () => this.handleFilterChange());
      }
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
        document.querySelectorAll('.filter-group select').forEach(s => s.value = '');
        document.querySelectorAll('.filter-group input[type="number"]').forEach(i => i.value = '');
        document.querySelectorAll('.filter-checkbox input').forEach(c => c.checked = false);
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
  }
};
