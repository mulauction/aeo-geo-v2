const cheerio = require('cheerio');

async function fetchEvidence(req, res) {
  try {
    const { url } = req.body;

    // Validate URL
    if (!url || typeof url !== 'string' || (!url.startsWith('http://') && !url.startsWith('https://'))) {
      return res.status(400).json({ fetch: null });
    }

    // Setup timeout (10s)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      // Fetch with redirect follow, custom UA, timeout
      const response = await fetch(url, {
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'User-Agent': 'aeo-geo-v2/phase172 (+https://example.invalid)'
        }
      });

      clearTimeout(timeoutId);

      const finalUrl = response.url || url;
      const status = response.status;
      const html = await response.text();

      // Parse HTML with cheerio
      const $ = cheerio.load(html);

      const title = $('title').first().text().trim() || '';
      const metaDescription = $('meta[name="description"]').attr('content')?.trim() || '';
      
      const headings = {
        h1: $('h1').length,
        h2: $('h2').length,
        h3: $('h3').length
      };

      const lists = {
        ul: $('ul').length,
        ol: $('ol').length
      };

      const links = $('a[href]').length;
      const canonical = $('link[rel="canonical"]').length > 0;
      const robots = $('meta[name="robots"]').length > 0;
      const jsonLd = $('script[type="application/ld+json"]').length > 0;
      
      const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
      const textLength = bodyText.length;

      const fetchedAt = new Date().toISOString();

      return res.status(200).json({
        fetch: {
          status,
          finalUrl,
          title,
          metaDescription,
          headings,
          lists,
          links,
          canonical,
          robots,
          jsonLd,
          textLength,
          fetchedAt
        }
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      // On any error (timeout, network, parse), return null
      console.warn('[fetchEvidence] fetch failed:', fetchError?.message || fetchError);
      return res.status(200).json({ fetch: null });
    }
  } catch (error) {
    // On any other error, return null
    console.warn('[fetchEvidence] error:', error?.message || error);
    return res.status(200).json({ fetch: null });
  }
}

module.exports = { fetchEvidence };
