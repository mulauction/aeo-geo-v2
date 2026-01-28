const cheerio = require('cheerio');

/**
 * SSRF 방어: localhost/127.0.0.1/사설 IP 대역 차단
 */
function isBlockedHost(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    
    // localhost 차단
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return true;
    }
    
    // 사설 IP 대역 차단
    // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const match = hostname.match(ipv4Regex);
    if (match) {
      const [_, a, b, c, d] = match.map(Number);
      if (a === 10) return true; // 10.0.0.0/8
      if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
      if (a === 192 && b === 168) return true; // 192.168.0.0/16
      if (a === 127) return true; // 127.0.0.0/8
    }
    
    return false;
  } catch (e) {
    return true; // URL 파싱 실패 시 차단
  }
}

/**
 * GET /api/fetch/evidence?url=...
 * 원격 HTML fetch 후 요약 JSON 반환
 */
async function fetchEvidenceGet(req, res) {
  try {
    const url = req.query.url;
    
    // Validate URL
    if (!url || typeof url !== 'string') {
      return res.status(200).json({
        attempted: false,
        success: false,
        reason: 'NO_URL',
        status: null,
        finalUrl: null,
        title: null,
        h1: null,
        headings: [],
        fetchedAt: new Date().toISOString()
      });
    }
    
    // http/https만 허용
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return res.status(200).json({
        attempted: false,
        success: false,
        reason: 'BLOCKED_HOST',
        status: null,
        finalUrl: null,
        title: null,
        h1: null,
        headings: [],
        fetchedAt: new Date().toISOString()
      });
    }
    
    // SSRF 방어: localhost/사설 IP 차단
    if (isBlockedHost(url)) {
      return res.status(200).json({
        attempted: false,
        success: false,
        reason: 'BLOCKED_HOST',
        status: null,
        finalUrl: null,
        title: null,
        h1: null,
        headings: [],
        fetchedAt: new Date().toISOString()
      });
    }
    
    // Fetch with timeout 8s, max 3 redirects
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
    let redirectCount = 0;
    let currentUrl = url;
    
    try {
      let response;
      while (redirectCount <= 3) {
        response = await fetch(currentUrl, {
          redirect: 'manual', // 수동 리다이렉트 처리
          signal: controller.signal,
          headers: {
            'User-Agent': 'aeo-geo-v2/phase172 (+https://example.invalid)'
          }
        });
        
        // 리다이렉트 처리
        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get('location');
          if (location && redirectCount < 3) {
            redirectCount++;
            // 절대 URL 또는 상대 URL 처리
            try {
              currentUrl = new URL(location, currentUrl).href;
            } catch (e) {
              // URL 파싱 실패 시 중단
              break;
            }
            continue;
          }
        }
        break;
      }
      
      clearTimeout(timeoutId);
      
      if (!response || !response.ok) {
        return res.status(200).json({
          attempted: true,
          success: false,
          reason: 'HTTP_ERROR',
          status: response?.status || null,
          finalUrl: currentUrl,
          title: null,
          h1: null,
          headings: [],
          fetchedAt: new Date().toISOString()
        });
      }
      
      const html = await response.text();
      
      // Parse HTML with cheerio
      const $ = cheerio.load(html);
      
      const title = $('title').first().text().trim() || null;
      const h1 = $('h1').first().text().trim() || null;
      
      // h2/h3 일부 추출 (최대 10개)
      const headings = [];
      $('h2, h3').each((idx, el) => {
        if (idx < 10) {
          const text = $(el).text().trim();
          if (text && text.length > 0 && text.length < 200) {
            headings.push(text);
          }
        }
      });
      
      return res.status(200).json({
        attempted: true,
        success: true,
        reason: null,
        status: response.status,
        finalUrl: currentUrl,
        title: title,
        h1: h1,
        headings: headings,
        fetchedAt: new Date().toISOString()
      });
      
    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      let reason = 'FETCH_ERROR';
      if (fetchError.name === 'AbortError') {
        reason = 'TIMEOUT';
      }
      
      return res.status(200).json({
        attempted: true,
        success: false,
        reason: reason,
        status: null,
        finalUrl: currentUrl,
        title: null,
        h1: null,
        headings: [],
        fetchedAt: new Date().toISOString()
      });
    }
  } catch (error) {
    // 예상치 못한 에러
    console.warn('[fetchEvidenceGet] error:', error?.message || error);
    return res.status(200).json({
      attempted: false,
      success: false,
      reason: 'FETCH_ERROR',
      status: null,
      finalUrl: null,
      title: null,
      h1: null,
      headings: [],
      fetchedAt: new Date().toISOString()
    });
  }
}

module.exports = { fetchEvidenceGet };
