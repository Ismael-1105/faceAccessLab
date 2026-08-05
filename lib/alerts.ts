import mongoose from 'mongoose';

/**
 * Acepta el ID público actual y, durante la transición, el ObjectId de
 * alertas históricas que fueron creadas antes de declarar `id` en el esquema.
 */
export function alertIdentifierFilter(id: string) {
  return mongoose.isValidObjectId(id)
    ? { $or: [{ id }, { _id: id }] }
    : { id };
}
