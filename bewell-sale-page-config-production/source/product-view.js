    function renderProductDetails(product) {
      const {doc, def} = product;
      const intro = doc.querySelector('.product.attribute.overview .value, [itemprop="description"].overview');
      const description = doc.querySelector('.product.attribute.description .value, [id="product.info.description"] .product.attribute.description, [id="product.info.description"]');
      const summary = intro?.textContent.trim() || doc.querySelector('meta[name="description"]')?.content?.trim() || '';
      $('.bw-intro').textContent = summary;
      $('.bw-intro').hidden = !summary;

      // Rebuild product content without scripts, forms, embeds, or theme-specific styles.
      const tags = new Set(['P','H2','H3','H4','H5','H6','UL','OL','LI','STRONG','B','EM','I','BR','IMG','TABLE','THEAD','TBODY','TR','TH','TD','DIV']);
      const skip = new Set(['SCRIPT','STYLE','NOSCRIPT','IFRAME','FORM','BUTTON','SVG','OBJECT','TEMPLATE','VIDEO','AUDIO','SOURCE','LINK','META']);
      function appendContent(source, target) {
        for (const child of source.childNodes) {
          if (child.nodeType === 3) { target.append(document.createTextNode(child.textContent)); continue; }
          if (child.nodeType !== 1 || skip.has(child.tagName)) continue;
          if (!tags.has(child.tagName)) { appendContent(child,target); continue; }
          if (child.tagName === 'IMG') {
            const image = child.getAttribute('data-src') || child.getAttribute('data-original') || child.getAttribute('src');
            if (!image) continue;
            let src;
            try { src = safeImage(new URL(image,sameStore(def.path)).href); } catch { continue; }
            if (!src) continue;
            const img = node('img');
            img.loading = 'lazy';
            img.alt = child.getAttribute('alt') || def.name;
            img.src = src;
            target.append(img);
            continue;
          }
          const element = node(child.tagName === 'H2' ? 'h3' : child.tagName.toLowerCase());
          appendContent(child,element);
          target.append(element);
        }
      }
      const content = $('#bw-pdp-description');
      if (description) appendContent(description,content);
      const hasDetails = Boolean(content.textContent.trim() || content.querySelector('img'));
      $('#bw-detail').hidden = !hasDetails;
      const link = $('.bw-nav a[href="#bw-detail"]');
      if (link) link.hidden = !hasDetails;
    }

    function buildAttributeSelectors(product, target) {
      const available = Object.values(product.config.index).map(attributes => choice(product,attributes)).filter(Boolean);
      if (!available.length) { target.textContent = 'ยังไม่มีตัวเลือกที่พร้อมจำหน่าย'; return; }
      target.classList.add('bw-main-attributes');
      const controls = product.attributes.map(attribute => {
        const label = node('label','bw-main-attribute',attribute.label);
        const select = node('select');
        label.append(select);
        target.append(label);
        return {attribute,select};
      });
      function update() {
        let matches = available;
        for (const {attribute,select} of controls) {
          const previous = select.value;
          const allowed = new Set(matches.map(item => String(item.attributes[attribute.id])));
          select.replaceChildren();
          for (const option of attribute.options) {
            if (!allowed.has(String(option.id))) continue;
            const item = node('option','',option.label);
            item.value = String(option.id);
            select.append(item);
          }
          if (allowed.has(previous)) select.value = previous;
          matches = matches.filter(item => String(item.attributes[attribute.id]) === select.value);
        }
        state.mainChoice = matches[0] || null;
        refreshMainImage();
        refresh();
      }
      for (const {select} of controls) select.addEventListener('change',update);
      update();
    }
