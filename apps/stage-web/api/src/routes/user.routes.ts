import { Router } from 'express';
import { body, param } from 'express-validator';
import { authenticate } from '../middleware/auth.middleware.js';
import { validateRequest } from '../middleware/validation.middleware.js';
import { asyncHandler } from '../middleware/error.middleware.js';
import * as userController from '../controllers/user.controller.js';

const router = Router();

/**
 * @route   GET /api/v1/users/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get(
  '/profile',
  authenticate,
  asyncHandler(userController.getProfile)
);

/**
 * @route   PATCH /api/v1/users/profile
 * @desc    Update user profile
 * @access  Private
 */
router.patch(
  '/profile',
  authenticate,
  [
    body('username')
      .optional()
      .isString()
      .isLength({ min: 3, max: 50 })
      .matches(/^[a-zA-Z0-9_-]+$/)
      .withMessage('Username must be 3-50 characters and contain only letters, numbers, underscores, and hyphens'),
    body('display_name')
      .optional()
      .isString()
      .isLength({ min: 1, max: 100 }),
    body('bio')
      .optional()
      .isString()
      .isLength({ max: 500 }),
    body('avatar_url')
      .optional()
      .isURL(),
    body('preferences')
      .optional()
      .isObject(),
  ],
  validateRequest,
  asyncHandler(userController.updateProfile)
);

/**
 * @route   DELETE /api/v1/users/profile
 * @desc    Delete user account
 * @access  Private
 */
router.delete(
  '/profile',
  authenticate,
  [
    body('confirmation')
      .equals('DELETE')
      .withMessage('Please confirm deletion by sending confirmation: "DELETE"'),
  ],
  validateRequest,
  asyncHandler(userController.deleteAccount)
);

/**
 * @route   GET /api/v1/users/stats
 * @desc    Get user usage statistics
 * @access  Private
 */
router.get(
  '/stats',
  authenticate,
  asyncHandler(userController.getUserStats)
);

/**
 * @route   POST /api/v1/users/change-password
 * @desc    Change user password
 * @access  Private
 */
router.post(
  '/change-password',
  authenticate,
  [
    body('current_password')
      .notEmpty()
      .withMessage('Current password is required'),
    body('new_password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters'),
  ],
  validateRequest,
  asyncHandler(userController.changePassword)
);

/**
 * @route   GET /api/v1/users/export
 * @desc    Export user data
 * @access  Private
 */
router.get(
  '/export',
  authenticate,
  asyncHandler(userController.exportUserData)
);

export default router;