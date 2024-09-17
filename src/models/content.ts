import { DataTypes } from 'sequelize';
import { AppDataSource } from '../config';

export const Content = AppDataSource.define(
  'content',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    identifier: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    name: {
      type: DataTypes.JSONB,
      allowNull: false,
    },
    description: {
      type: DataTypes.JSONB,
      allowNull: false,
    },
    tenant: {
      type: DataTypes.JSONB,
      allowNull: false,
    },
    repository: {
      type: DataTypes.JSONB,
      allowNull: false,
    },
    taxonomy: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    sub_skills: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    gradient: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('draft', 'live'),
      allowNull: true,
    },
    media: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    created_by: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    updated_by: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
    },
  },
  {
    tableName: 'content',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
);
