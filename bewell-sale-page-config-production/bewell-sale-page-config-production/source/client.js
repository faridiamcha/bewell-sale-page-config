(() => {
  'use strict';
  const templates = JSON.parse(document.getElementById('templates').textContent);
  const store = 'https://bewellofficial.com';
  const storageKey = 'bewell-sale-page-config-v1';
  const form = document.getElementById('settings');
  const byId = id => document.getElementById(id);
  const listNames = ['gifts', 'related', 'addons'];
  const outputNames = {html:'HTML', css:'CSS', script:'Script'};
  const money = value => '฿' + Number(value).toLocaleString('th-TH', {maximumFractionDigits:2});
  let active = 'html';
  let codes = null;

  function fields(type) {
    if (type === 'gifts') return [
      ['name','ชื่อของแถม',true], ['image','ลิงก์รูปของแถม (ถ้ามี)'],
      ['terms','เงื่อนไขของแถม'], ['threshold','ยอดขั้นต่ำ (บาท) ถ้ามี',false,'number']
    ];
    const items = [['path','ลิงก์หน้าสินค้า Bewell',true], ['name','ชื่อที่แสดง (ถ้ามี)']];
    if (type === 'addons') items.push(['dealText','ข้อความดีลซื้อคู่ (ถ้ามี)']);
    return items;
  }

  function updateRowLabels(type) {
    const root = byId(type);
    const rows = [...root.querySelectorAll('.row')];
    root.querySelector('.empty')?.remove();
    if (!rows.length) {
      const empty = document.createElement('p');
      empty.className = 'empty';
      empty.textContent = 'ยังไม่มีรายการ กดปุ่มเพิ่มเพื่อใส่ข้อมูล';
      root.append(empty);
    }
    rows.forEach((row, index) => {
      row.querySelector('strong').textContent = 'รายการ ' + (index + 1);
      row.querySelector('button').setAttribute('aria-label','ลบ ' + type + ' รายการ ' + (index + 1));
    });
  }

  function addRow(type, values = {}, focus = false) {
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = '<div class="row-head"><strong></strong><button type="button" class="btn mini remove">ลบ</button></div><div class="fields"></div>';
    for (const [key, labelText, required, inputType] of fields(type)) {
      const label = document.createElement('label');
      label.textContent = labelText;
      const input = document.createElement('input');
      input.dataset.field = key;
      input.type = inputType || 'text';
      input.value = values[key] ?? '';
      input.required = Boolean(required);
      input.maxLength = key === 'path' || key === 'image' ? 600 : 200;
      if (input.type === 'number') { input.min = '0.01'; input.step = '0.01'; }
      label.append(input);
      row.querySelector('.fields').append(label);
    }
    row.querySelector('button').addEventListener('click', () => { row.remove(); updateRowLabels(type); changed(); });
    byId(type).append(row);
    updateRowLabels(type);
    if (focus) row.querySelector('input').focus();
  }

  function read() {
    const values = {};
    for (const input of form.querySelectorAll('[name]')) values[input.name] = input.type === 'checkbox' ? input.checked : input.value.trim();
    for (const name of listNames) values[name] = [...byId(name).querySelectorAll('.row')].map(row => Object.fromEntries([...row.querySelectorAll('input')].map(input => [input.dataset.field,input.value.trim()])));
    return values;
  }

  function showOutput() {
    byId('output').value = codes?.[active] ?? '';
    byId('copy').textContent = 'คัดลอก ' + outputNames[active];
    byId('copy').disabled = byId('download').disabled = !codes;
    document.querySelectorAll('[data-code]').forEach(tab => tab.setAttribute('aria-selected', String(tab.dataset.code === active)));
  }

  function changed() {
    const data = read();
    try { localStorage.setItem(storageKey,JSON.stringify(data)); } catch { byId('storage').textContent = 'เบราว์เซอร์นี้ปิดการบันทึกอัตโนมัติ'; }
    if (codes) byId('status').textContent = 'แก้ข้อมูลแล้ว กดสร้างโค้ดอีกครั้ง';
    codes = null;
    showOutput();
    const showCoupon = data.coupon && data.after !== '' && (data.mode === 'draft' || data.couponVerified);
    byId('preview-title').textContent = data.headline || data.title || 'ชื่อแคมเปญของคุณ';
    byId('preview-price').textContent = showCoupon ? money(data.after) : data.sale !== '' ? money(data.sale) : '—';
    byId('preview-price-note').textContent = showCoupon ? 'ราคาหลังใช้โค้ด' : data.sale !== '' ? 'ราคาขายที่แสดง' : 'ใช้ราคาจาก Magento เมื่อเปิดหน้าจริง';
    byId('preview-coupon').textContent = showCoupon ? 'โค้ด ' + data.coupon : '';
    byId('preview-mode').textContent = data.mode.toUpperCase();
    byId('preview-lists').textContent = `ของแถม ${data.gifts.length} · Related ${data.related.length} · Add-on ${data.addons.length}`;
  }

  function load(data) {
    for (const input of form.querySelectorAll('[name]')) {
      if (!(input.name in data)) continue;
      if (input.type === 'checkbox') input.checked = Boolean(data[input.name]);
      else input.value = data[input.name];
    }
    for (const name of listNames) {
      byId(name).replaceChildren();
      for (const row of Array.isArray(data[name]) ? data[name] : []) addRow(name,row);
      updateRowLabels(name);
    }
    byId('status').textContent = '';
    changed();
  }

  function storePath(value, label, image = false) {
    let url;
    try { url = new URL(value, store + '/'); } catch { throw new Error('ลิงก์ไม่ถูกต้อง · ' + label); }
    if (url.origin !== store || url.username || url.password || url.pathname === '/' || /[{}]/.test(url.pathname)) throw new Error('ใช้ลิงก์บน bewellofficial.com · ' + label);
    return image ? url.pathname + url.search : url.pathname;
  }

  function generate(data) {
    const amount = name => data[name] === '' ? null : Number(data[name]);
    const list = amount('list'), sale = amount('sale'), afterPrice = amount('after');
    if (list !== null && sale !== null && list < sale) throw new Error('ราคาตั้งต้องไม่น้อยกว่าราคาขาย');
    if (Boolean(data.coupon) !== (afterPrice !== null)) throw new Error('กรอกโค้ดส่วนลดและราคาหลังใช้โค้ดคู่กัน');
    if (sale !== null && afterPrice !== null && afterPrice > sale) throw new Error('ราคาหลังใช้โค้ดต้องไม่เกินราคาขาย');
    const mainPath = storePath(data.mainPath, 'สินค้าหลัก');
    const mainImage = data.image ? storePath(data.image, 'รูปหลัก', true) : '';
    const config = {
      presentationMode: data.mode, hideBreadcrumbs:true,
      cartEnabled:data.cart, allowedOrigin:store, storeBase:'/', redirectToCart:true, maxQty:10, timeoutMs:20000,
      pricing:{list,sale,overrideVariants:data.overrideVariants},
      coupon:{enabled:!!data.coupon, verified:data.couponVerified, code:data.coupon, afterPrice, discountPerUnit:sale !== null && afterPrice !== null ? sale-afterPrice : null, terms:data.couponTerms || 'กรอกโค้ดในตะกร้าตามเงื่อนไขแคมเปญ', startsAt:'', endsAt:''},
      main:{key:'main', name:data.title, path:mainPath, image:mainImage, variants:[]},
      gifts:{enabled:!!data.gifts.length, verified:data.giftVerified, items:data.gifts.map((gift,index) => ({name:gift.name, image:gift.image ? storePath(gift.image,`รูปของแถม ${index+1}`,true) : '', terms:gift.terms, mode:gift.threshold ? 'threshold' : 'always', threshold:gift.threshold ? Number(gift.threshold) : 0}))}
    };
    for (const group of ['related','addons']) {
      const paths = new Set([mainPath]);
      config[group] = data[group].map((item,index) => {
        const path = storePath(item.path, `${group} รายการ ${index+1}`);
        if (paths.has(path)) throw new Error('ลิงก์สินค้าซ้ำ · ' + group + ' รายการ ' + (index+1));
        paths.add(path);
        return {key:group+'-'+index, path, name:item.name, dealText:item.dealText || ''};
      });
    }
    const template = document.createElement('template');
    template.innerHTML = templates.html;
    const root = template.content;
    const one = selector => root.querySelector(selector);
    const setText = (selector,value) => { one(selector).textContent = value; };
    const enlight = mainPath.endsWith('/ergonomic-chair-enlight.html');
    setText('#bw-title',data.headline || data.title);
    setText('.bw-subtitle',data.title);
    setText('.bw-intro','');
    one('.bw-intro').hidden = true;
    root.querySelectorAll('.bw-visual-word,.bw-tag,.bw-visual-note,.bw-seal,.bw-gallery-arrow,#bw-gallery-toggle,.bw-intro-band,.bw-lifestyle').forEach(element => element.remove());
    setText('.bw-caption','แตะรูปย่อหรือปัดบนรูปเพื่อดูภาพอื่น');
    const details = one('#bw-detail');
    details.className = 'bw-pdp-details bw-wrap';
    details.hidden = true;
    details.innerHTML = '<div class="bw-section-head"><h2 id="bw-detail-title">รายละเอียดสินค้า</h2></div><div id="bw-pdp-description"></div>';
    one('.bw-nav a[href="#bw-detail"]').hidden = true;
    const qty = one('#bw-qty');
    const qtyLabel = qty.parentElement;
    const control = document.createElement('span');
    control.className = 'bw-qty-control';
    control.innerHTML = '<button id="bw-qty-minus" class="bw-qty-step" type="button" aria-label="ลดจำนวน" disabled>−</button><button id="bw-qty-plus" class="bw-qty-step" type="button" aria-label="เพิ่มจำนวน">+</button>';
    control.insertBefore(qty,control.lastElementChild);
    const group = document.createElement('div');
    group.append(qtyLabel.cloneNode(true),control);
    qtyLabel.replaceWith(group);
    setText('.bw-deal-heading > span','BEWELL CAMPAIGN');
    setText('.bw-sticky div > span',data.title);
    setText('.bw-closing a','กลับไปเลือกสินค้า');
    setText('#bw-faq-title','คำถามก่อนเลือกซื้อ');
    one('.bw-gallery-stage').setAttribute('aria-label','แกลเลอรีสินค้า');
    one('.bw-nav').setAttribute('aria-label','เมนูแคมเปญ');
    one('.bw-wordmark').firstChild.nodeValue = enlight ? 'ENLIGHT' : 'CAMPAIGN';
    one('#bw-main-image').alt = data.title;
    if (mainImage) one('#bw-main-image').setAttribute('src',mainImage);
    else if (!enlight) one('#bw-main-image').removeAttribute('src');
    one('noscript a').setAttribute('href',mainPath);
    if (!enlight) {
      root.querySelectorAll('.bw-topline span,.bw-services,.bw-text-link,.bw-assurance,.bw-faq details:last-child').forEach(element => element.remove());
      setText('.bw-offer .bw-eyebrow','BEWELL EXCLUSIVE SELECTION');
      setText('.bw-closing h2','เลือกสินค้าที่ใช่สำหรับคุณ');
      setText('.bw-nav-cta','เลือกสินค้า');
    }
    if (!config.addons.length) one('.bw-nav a[href="#bw-addons"]')?.remove();
    // Encode user values so they cannot close the script or trigger Magento directives.
    const serialized = JSON.stringify(config,null,2).replace(/[<>&\u2028\u2029]|\{\{|\}\}/g, chars => [...chars].map(char => '\\u'+char.charCodeAt(0).toString(16).padStart(4,'0')).join(''));
    const html = template.innerHTML.replace(/\{\{|\}\}/g, chars => [...chars].map(char => '&#'+char.charCodeAt(0)+';').join(''));
    return {
      html:'<meta name="robots" content="noindex,nofollow">\n'+html.trim(),
      css:templates.css,
      script:'<script>\n'+templates.script.replace('/* CAMPAIGN_CONFIG */ {}',() => serialized)+'\n</script>'
    };
  }

  form.addEventListener('input', event => {
    if (['coupon','after','list','sale','couponTerms','mainPath'].includes(event.target.name)) form.elements.couponVerified.checked = false;
    if (event.target.closest('#gifts') || event.target.name === 'mainPath') form.elements.giftVerified.checked = false;
    changed();
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    try {
      codes = generate(read());
      active = 'html'; showOutput();
      byId('status').textContent = 'พร้อมคัดลอกทั้ง 3 ชุด';
      byId('tab-html').focus();
    } catch (error) { codes = null; showOutput(); byId('status').textContent = error.message; byId('status').scrollIntoView({block:'nearest'}); }
  });
  form.addEventListener('reset', () => setTimeout(() => load({}),0));
  document.querySelectorAll('[data-add]').forEach(button => button.addEventListener('click',() => { addRow(button.dataset.add,{},true); changed(); }));
  document.querySelectorAll('[data-code]').forEach(tab => tab.addEventListener('click',() => { active = tab.dataset.code; showOutput(); }));
  byId('copy').addEventListener('click', async () => {
    if (!codes) return;
    const label = outputNames[active];
    try { await navigator.clipboard.writeText(codes[active]); }
    catch {
      const output = byId('output'); output.focus(); output.select();
      if (!document.execCommand('copy')) { byId('status').textContent = 'เลือกโค้ดแล้ว กด Ctrl+C หรือ Command+C เพื่อคัดลอก'; return; }
    }
    byId('status').textContent = 'คัดลอก ' + label + ' แล้ว';
  });
  byId('download').addEventListener('click', () => {
    if (!codes) return;
    const url = URL.createObjectURL(new Blob([codes[active]],{type:'text/plain;charset=utf-8'}));
    const link = document.createElement('a'); link.href = url; link.download = `bewell-sale-page-${active}.txt`; link.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
  });
  byId('example').addEventListener('click', () => load({
    title:'Bewell ENLIGHT', headline:'นั่งสบาย ในจังหวะของคุณ', mainPath:store+'/ergonomic-chair-enlight.html', image:'', mode:'draft', cart:true,
    list:'12990', sale:'9999', after:'8999', overrideVariants:false, coupon:'ENLIGHT1000', couponTerms:'ตัวอย่างใน Draft', couponVerified:false, giftVerified:false,
    gifts:[{name:'ที่พักเท้า 2 ชั้น',image:'/pub/media/catalog/product/cache/2891eed40c6a15a9c1fe3827f4b31fc9/2/0/20260623_revise_mkp_x_logo_ergonomic_office_gadgets__ef02.jpg',terms:'ตัวอย่างของแถม',threshold:''}],
    related:[{path:'/multi-function-holder.html',name:'ที่วางของอเนกประสงค์'},{path:'/armrest-support.html',name:'ที่วางแขน'}],
    addons:[{path:'/ergonomic-adjustable-dual-motor-desk.html',name:'โต๊ะปรับระดับไฟฟ้า มอเตอร์คู่',dealText:''}]
  }));
  let previous = {};
  try { previous = JSON.parse(localStorage.getItem(storageKey)) || {}; } catch { /* Fresh form */ }
  load(previous);
})();
