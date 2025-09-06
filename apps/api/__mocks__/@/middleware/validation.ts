// Mock validation middleware
export const schemas = {
  signIn: {},
  signUp: {},
  resetPassword: {},
  updateProfile: {},
};

// Mock validate function that returns a middleware
export const validate = jest.fn((schema: any) => {
  return (req: any, res: any, next: any) => {
    // By default, validation passes
    if (next) next();
  };
});