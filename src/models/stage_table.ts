import { DataTypes } from 'sequelize';
import { AppDataSource } from '../config';

export const StageTable = AppDataSource.define(
  'tem_table',
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
    },
    process_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    question_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    question_set_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    sequence: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    question_type: {
      type: DataTypes.ENUM('grid1', 'grid2', 'mcq', 'fib'),
      allowNull: true,
    },
    repository_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    board: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    class: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    L1_skill: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    L2_skill: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    L3_skill: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    gradient: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    hint: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    description: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    body: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
  },
  {
    tableName: 'stage_table',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
);
