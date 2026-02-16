type LocationMocks = {
  assign: jest.Mock<void, [string]>;
  reload: jest.Mock<void, []>;
  replace: jest.Mock<void, [string]>;
};

type LocationOverrides = {
  href: string;
  origin: string;
  protocol: string;
  host: string;
  hostname: string;
  port: string;
  pathname: string;
  search: string;
};

declare global {
  var setMockLocation: (url: string) => LocationMocks;
  var __locationMocks: LocationMocks | undefined;
  var __locationOverrides: LocationOverrides | undefined;
}

export {};
