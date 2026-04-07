const securityHeaders = {
  helmetOptions: {
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false
  },
  cspOptions: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        'https://js.stripe.com',
        'https://cdn.jsdelivr.net/npm/chart.js',
        'https://api.mapbox.com',
        'https://cdn.socket.io',
        'https://accounts.google.com',
        'https://apis.google.com',
        'https://www.gstatic.com'
      ],
      workerSrc: ["'self'", 'blob:', 'https://api.mapbox.com'],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        'https://fonts.googleapis.com',
        'https://cdnjs.cloudflare.com',
        'https://api.mapbox.com'
      ],
      styleSrcElem: [
        "'self'",
        "'unsafe-inline'",
        'https://fonts.googleapis.com',
        'https://cdnjs.cloudflare.com',
        'https://api.mapbox.com'
      ],
      fontSrc: [
        "'self'",
        'https://fonts.gstatic.com',
        'https://cdnjs.cloudflare.com'
      ],
      connectSrc: [
        "'self'",
        'ws://localhost:3000',
        'wss://localhost:3000',
        'https://api.mapbox.com',
        'https://js.stripe.com',
        'https://accounts.google.com',
        'https://oauth2.googleapis.com',
        'https://www.gstatic.com',
        'https://test-payment.momo.vn',
        'https://payment.momo.vn'
      ],
      imgSrc: [
        "'self'",
        'data:',
        'https://api.mapbox.com',
        'https://lh3.googleusercontent.com',
        'https://ssl.gstatic.com',
        'https://www.gstatic.com'
      ],
      frameSrc: [
        "'self'",
        'https://js.stripe.com',
        'https://accounts.google.com',
        'https://www.google.com',
        'https://test-payment.momo.vn',
        'https://payment.momo.vn'
      ],
      navigateSrc: [
        "'self'",
        'https://checkout.stripe.com',
        'https://test-payment.momo.vn',
        'https://payment.momo.vn'
      ]
    }
  }
};

module.exports = securityHeaders;
