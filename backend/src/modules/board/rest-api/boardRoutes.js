import { Router } from 'express';
import {
  getBoard,
  createBoardElement,
  updateBoardElements,
  removeBoardElement
} from './boardController.js';

const router = Router();

//router.use(verifyJwt);

// GET /boards/:id
router.get('/:id', getBoard);

// POST /boards/:boardId/elements
router.post('/:boardId/elements', createBoardElement);

// PUT /boards/:boardId/elements
router.put('/:boardId/elements', updateBoardElements);

// DELETE /boards/:boardId/elements/:elementId
router.delete('/:boardId/elements/:elementId', removeBoardElement);

export default router;
