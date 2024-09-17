import { DataTypes } from 'sequelize';
import { AppDataSource } from '../config';

export const QuestionSet = AppDataSource.define(
  'question_set',
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
    title: {
      type: DataTypes.JSONB,
    },
    description: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    qsid: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    repository: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    sequence: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    taxonomy: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    sub_skills: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
    },
    purpose: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    is_atomic: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    gradient: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    group_name: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('draft', 'live'),
      allowNull: false,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    created_by: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    updated_by: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    tableName: 'question_set',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
);
