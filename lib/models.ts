import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  name: string;
  role: 'admin' | 'docente' | 'estudiante';
  studentId?: string;
  createdAt: Date;
}

export interface IStudent extends Document {
  id: string;
  name: string;
  lastName?: string;
  documentId?: string;
  email?: string;
  phone?: string;
  career: string;
  lab: string;
  labs?: string[];
  photoUrl: string;
  photoKey?: string;
  matchPercentage: number;
  status: 'allowed' | 'denied';
  avatarInitials: string;
  faceEmbeddingId?: string;
  createdAt: Date;
}

export interface IAccessLog extends Document {
  studentId: string;
  studentName: string;
  avatarInitials: string;
  date: string;
  time: string;
  result: 'Permitido' | 'Denegado';
  similarity: number;
  kioskId?: string;
  createdAt: Date;
}

export interface IAlert extends Document {
  severity: 'critical' | 'warning' | 'info';
  source: string;
  message: string;
  timestamp: string;
  status: 'active' | 'acknowledged' | 'resolved';
  createdAt: Date;
}

export interface ILab extends Document {
  id: string;
  name: string;
  code: string;
  description?: string;
  active: boolean;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>({
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String, enum: ['admin', 'docente', 'estudiante'], required: true },
  studentId: { type: String },
  createdAt: { type: Date, default: Date.now },
});

const StudentSchema = new Schema<IStudent>({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  lastName: { type: String },
  documentId: { type: String },
  email: { type: String },
  phone: { type: String },
  career: { type: String, required: true },
  lab: { type: String, required: true },
  labs: { type: [String], default: undefined },
  photoUrl: { type: String, default: '/images/default-avatar.jpg' },
  photoKey: { type: String },
  matchPercentage: { type: Number, default: 0 },
  status: { type: String, enum: ['allowed', 'denied'], default: 'allowed' },
  avatarInitials: { type: String, required: true },
  faceEmbeddingId: { type: String },
  createdAt: { type: Date, default: Date.now },
}, { id: false });

const AccessLogSchema = new Schema<IAccessLog>({
  studentId: { type: String, required: true },
  studentName: { type: String, required: true },
  avatarInitials: { type: String, required: true },
  date: { type: String, required: true },
  time: { type: String, required: true },
  result: { type: String, enum: ['Permitido', 'Denegado'], required: true },
  similarity: { type: Number, required: true },
  kioskId: { type: String, default: 'Kiosk-042' },
  createdAt: { type: Date, default: Date.now },
});

const AlertSchema = new Schema<IAlert>({
  severity: { type: String, enum: ['critical', 'warning', 'info'], required: true },
  source: { type: String, required: true },
  message: { type: String, required: true },
  timestamp: { type: String, required: true },
  status: { type: String, enum: ['active', 'acknowledged', 'resolved'], default: 'active' },
  createdAt: { type: Date, default: Date.now },
});

const LabSchema = new Schema<ILab>({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  description: { type: String },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
}, { id: false });

export const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
export const Student = mongoose.models.Student || mongoose.model<IStudent>('Student', StudentSchema);
export const AccessLog = mongoose.models.AccessLog || mongoose.model<IAccessLog>('AccessLog', AccessLogSchema);
export const Alert = mongoose.models.Alert || mongoose.model<IAlert>('Alert', AlertSchema);
export const Lab = mongoose.models.Lab || mongoose.model<ILab>('Lab', LabSchema);
