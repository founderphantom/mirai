// Mock error middleware
export const asyncHandler = jest.fn((handler: any) => {
  // Simply return the handler without wrapping
  return handler;
});

export const errorHandler = jest.fn((err: any, req: any, res: any, next: any) => {
  res.status(500).json({ error: 'Internal server error' });
});