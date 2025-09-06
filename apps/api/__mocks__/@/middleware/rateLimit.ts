// Mock rate limiting middleware
export const authRateLimit = jest.fn((req: any, res: any, next: any) => {
  // By default, rate limiting passes
  if (next) next();
});

export const apiRateLimit = jest.fn((req: any, res: any, next: any) => {
  // By default, rate limiting passes
  if (next) next();
});