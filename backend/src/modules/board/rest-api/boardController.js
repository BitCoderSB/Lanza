import {
  findBoardById,
  createBoard,
  upsertElement,
  updateElements,
  deleteElement
} from '../persistence/boardRepository.js';

export async function getBoard(req, res, next) {
  try {
    const { id } = req.params;
    let board = await findBoardById(id);
    if (!board) {
      await createBoard(id);
      board = { _id: id, elements: [] };
      // Pizarra no encontrada, creando nueva
    }
    res.json({ id: board._id, elements: board.elements });
  } catch (err) {
    next(err);
  }
}

export async function createBoardElement(req, res, next) {
  try {
    const { boardId } = req.params;
    const { element } = req.body;
    if (!element || !element.id) {
      return res.status(400).json({ error: 'element.id es requerido' });
    }
    await upsertElement(boardId, element);
    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function updateBoardElements(req, res, next) {
  try {
    const { boardId } = req.params;
    const { elements } = req.body;
    if (!Array.isArray(elements)) {
      return res.status(400).json({ error: 'elements debe ser un array' });
    }
    await updateElements(boardId, elements);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function removeBoardElement(req, res, next) {
  try {
    const { boardId, elementId } = req.params;
    await deleteElement(boardId, elementId);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}