import { Router } from 'express';
import { body } from 'express-validator';
import { strictRateLimiter } from '../middleware/rateLimit.middleware.js';
import { validateRequest, customValidators } from '../middleware/validation.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import { optionalAuth } from '../middleware/auth.middleware.js';
import * as authController from '../controllers/auth.controller.js';

const router = Router();

/**
 * @route   POST /api/v1/auth/signup
 * @desc    Register a new user
 * @access  Public
 */
router.post(
  '/signup',
  strictRateLimiter,
  [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .custom(customValidators.isStrongPassword)
      .withMessage('Password must contain uppercase, lowercase, and number'),
    body('full_name')
      .optional()
      .isString()
      .isLength({ min: 2, max: 100 })
      .withMessage('Full name must be between 2 and 100 characters'),
  ],
  validateRequest,
  asyncHandler(authController.signup)
);

/**
 * @route   POST /api/v1/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post(
  '/login',
  strictRateLimiter,
  [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
    body('password')
      .notEmpty()
      .withMessage('Password is required'),
  ],
  validateRequest,
  asyncHandler(authController.login)
);

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post(
  '/logout',
  optionalAuth,
  asyncHandler(authController.logout)
);

/**
 * @route   POST /api/v1/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
router.post(
  '/refresh',
  [
    body('refresh_token')
      .notEmpty()
      .withMessage('Refresh token is required'),
  ],
  validateRequest,
  asyncHandler(authController.refreshToken)
);

/**
 * @route   POST /api/v1/auth/forgot-password
 * @desc    Request password reset
 * @access  Public
 */
router.post(
  '/forgot-password',
  strictRateLimiter,
  [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
  ],
  validateRequest,
  asyncHandler(authController.forgotPassword)
);

/**
 * @route   POST /api/v1/auth/reset-password
 * @desc    Reset password with token
 * @access  Public
 */
router.post(
  '/reset-password',
  strictRateLimiter,
  [
    body('token')
      .notEmpty()
      .withMessage('Reset token is required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .custom(customValidators.isStrongPassword)
      .withMessage('Password must contain uppercase, lowercase, and number'),
  ],
  validateRequest,
  asyncHandler(authController.resetPassword)
);

/**
 * @route   POST /api/v1/auth/verify-email
 * @desc    Verify email with token
 * @access  Public
 */
router.post(
  '/verify-email',
  [
    body('token')
      .notEmpty()
      .withMessage('Verification token is required'),
  ],
  validateRequest,
  asyncHandler(authController.verifyEmail)
);

/**
 * @route   POST /api/v1/auth/resend-verification
 * @desc    Resend email verification
 * @access  Public
 */
router.post(
  '/resend-verification',
  strictRateLimiter,
  [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
  ],
  validateRequest,
  asyncHandler(authController.resendVerification)
);

/**
 * @route   POST /api/v1/auth/oauth/:provider
 * @desc    OAuth authentication callback
 * @access  Public
 */
router.post(
  '/oauth/:provider',
  asyncHandler(authController.oauthCallback)
);

/**
 * @route   GET /api/v1/auth/session
 * @desc    Get current session info
 * @access  Public
 */
router.get(
  '/session',
  optionalAuth,
  asyncHandler(authController.getSession)
);

export default router;