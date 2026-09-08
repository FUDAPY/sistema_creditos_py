import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model, Document } from 'mongoose';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import type { Role } from '@syscreditos/shared';

export interface UserDoc extends Document {
  uid: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  companyId: string;
  passwordHash?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface PublicUser {
  id: string;
  uid: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  companyId: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface CreateUserInput {
  email: string;
  name: string;
  role: Role;
  password: string;
  isActive?: boolean;
  companyId?: string;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectModel('User') private readonly userModel: Model<UserDoc>,
    private readonly config: ConfigService,
  ) {}

  private defaultCompanyId(): string {
    return this.config.get<string>('COMPANY_ID', 'lin_group_sa_001');
  }

  private async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  toPublicUser(doc: UserDoc): PublicUser {
    const rawId = (doc as unknown as { _id?: string | { toString(): string } })._id;
    const id = rawId ? String(rawId) : doc.uid;
    return {
      id,
      uid: doc.uid ?? id,
      email: doc.email,
      name: doc.name,
      role: doc.role,
      isActive: doc.isActive,
      companyId: doc.companyId,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  async findByCompanyAndEmail(
    companyId: string,
    email: string,
    includePassword = false,
  ): Promise<UserDoc | null> {
    const q = this.userModel.findOne({ companyId, email: email.toLowerCase().trim() });
    return includePassword ? q.select('+passwordHash') : q;
  }

  async findByUid(companyId: string, uid: string): Promise<UserDoc | null> {
    return this.userModel.findOne({ companyId, uid });
  }

  async list(companyId: string, activeOnly = false): Promise<PublicUser[]> {
    const filter: Record<string, unknown> = { companyId };
    if (activeOnly) filter.isActive = true;
    const docs = await this.userModel.find(filter).sort({ name: 1 }).exec();
    return docs.map((d) => this.toPublicUser(d));
  }

  async create(input: CreateUserInput): Promise<PublicUser> {
    const companyId = input.companyId?.trim() || this.defaultCompanyId();
    const email = input.email.toLowerCase().trim();
    const existing = await this.findByCompanyAndEmail(companyId, email);
    if (existing) {
      throw new ConflictException('Ya existe un usuario con ese email en la empresa.');
    }
    const uid = randomUUID();
    const now = Date.now();
    const doc = await this.userModel.create({
      _id: uid,
      uid,
      email,
      name: input.name.trim(),
      role: input.role,
      isActive: input.isActive ?? true,
      companyId,
      passwordHash: await this.hashPassword(input.password),
      createdAt: now,
      updatedAt: now,
    });
    return this.toPublicUser(doc);
  }

  async update(
    companyId: string,
    uid: string,
    patch: Partial<Pick<PublicUser, 'name' | 'role' | 'isActive'>>,
  ): Promise<PublicUser> {
    const doc = await this.userModel
      .findOneAndUpdate(
        { companyId, uid },
        { $set: { ...patch, updatedAt: Date.now() } },
        { new: true },
      )
      .exec();
    if (!doc) throw new NotFoundException('Usuario no encontrado.');
    return this.toPublicUser(doc);
  }

  async setPassword(companyId: string, uid: string, password: string): Promise<void> {
    const res = await this.userModel
      .updateOne(
        { companyId, uid },
        { $set: { passwordHash: await this.hashPassword(password), updatedAt: Date.now() } },
      )
      .exec();
    if (res.matchedCount === 0) throw new NotFoundException('Usuario no encontrado.');
  }
}

