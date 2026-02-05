// Quick test to see if modifying our mock location works

const originalLocation = window.location;
console.log('Original location:', originalLocation);

// Delete and replace 
delete (window).location;
(window).location = {
  href: 'http://localhost/',
  hostname: 'localhost',
  port: '',
  protocol: 'http:',
  host: 'localhost',
  replace: jest.fn(),
  reload: jest.fn(),
  assign: jest.fn(),
};

console.log('After delete+assign:',  window.location);

// Now try to modify
window.location.port = '3087';
window.location.host = 'localhost:3087';

console.log('After modification:', window.location);
console.log('Port value:', window.location.port);
console.log('Host value:', window.location.host);
