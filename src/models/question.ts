import { DataTypes } from 'sequelize';
import { AppDataSource } from '../config';

export const Question = AppDataSource.define(
  'question',
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
    qid: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    question_set_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    benchmark_time: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    type: {
      type: DataTypes.ENUM('Grid-1', 'mcq', 'fib', 'Grid-2'),
      allowNull: false,
    },
    operation: {
      type: DataTypes.ENUM('add', 'sub', 'multiple', 'division'),
      allowNull: true,
    },
    name: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    description: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    tenant: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    repository: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    taxonomy: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    gradient: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    hints: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('draft', 'live'),
      allowNull: false,
    },
    media: {
      type: DataTypes.ARRAY(DataTypes.JSONB),
      allowNull: true,
    },
    question_body: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    created_by: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    updated_by: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: 'question',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
);
