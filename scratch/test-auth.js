const http = require('http');

function makeRequest(url, options = {}, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function run() {
  try {
    console.log('1. Fetching CSRF token...');
    const csrfRes = await makeRequest('http://127.0.0.1:3000/api/auth/csrf');
    console.log('CSRF Response Status:', csrfRes.statusCode);
    const csrfData = JSON.parse(csrfRes.body);
    const csrfToken = csrfData.csrfToken;
    console.log('CSRF Token:', csrfToken);

    // Extract cookie from CSRF response
    const csrfCookie = csrfRes.headers['set-cookie'] 
      ? csrfRes.headers['set-cookie'].map(c => c.split(';')[0]).join('; ')
      : '';
    console.log('CSRF Cookie:', csrfCookie);

    console.log('\n2. Logging in with credentials...');
    const loginPayload = JSON.stringify({
      email: 'buyer@marketplace.com',
      password: 'Password123!',
      csrfToken: csrfToken,
      redirect: 'false',
      json: 'true'
    });

    const loginRes = await makeRequest('http://127.0.0.1:3000/api/auth/callback/credentials', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': csrfCookie
      }
    }, loginPayload);

    console.log('Login Response Status:', loginRes.statusCode);
    console.log('Login Headers:', JSON.stringify(loginRes.headers, null, 2));
    console.log('Login Body:', loginRes.body);

    const sessionCookies = loginRes.headers['set-cookie']
      ? loginRes.headers['set-cookie'].map(c => c.split(';')[0]).join('; ')
      : '';
    
    const combinedCookies = [csrfCookie, sessionCookies].filter(Boolean).join('; ');
    console.log('Combined Cookies:', combinedCookies);

    console.log('\n3. Fetching session...');
    const sessionRes = await makeRequest('http://127.0.0.1:3000/api/auth/session', {
      headers: {
        'Cookie': combinedCookies
      }
    });

    console.log('Session Response Status:', sessionRes.statusCode);
    console.log('Session Body:', sessionRes.body);

    console.log('\n4. Creating a new listing...');
    const listingPayload = JSON.stringify({
      title: 'Luxury Villa Test',
      description: 'This is a beautiful test villa with 4 bedrooms.',
      price: 12500000,
      address: 'Lamphelpat, Imphal West',
      propertyType: 'HOUSE',
      status: 'ACTIVE',
      latitude: 24.821,
      longitude: 93.916,
      images: ['https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=800&q=80'],
      polygonWkt: 'POLYGON((93.9150 24.8200, 93.9175 24.8200, 93.9175 24.8220, 93.9150 24.8220, 93.9150 24.8200))'
    });

    const listingRes = await makeRequest('http://127.0.0.1:3000/api/listings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': combinedCookies
      }
    }, listingPayload);

    console.log('Listing Response Status:', listingRes.statusCode);
    console.log('Listing Response Body:', listingRes.body);

  } catch (err) {
    console.error('Error:', err);
  }
}

run();
