import { DataTypes } from 'sequelize';
import { AppDataSource } from '../config';

export const StageTable = AppDataSource.define(
  'stage_table',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    process_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    question_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    question_set_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    sequence: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    question_type: {
      type: DataTypes.STRING,
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
    benchmark_time: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    sub_skill: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    sub_skill_carry: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    sub_skill_procedural: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    sub_skill_x0: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    sub_skill_xx: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    media_file_1: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    media_file_2: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    media_file_3: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    media_file_4: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    media_file_5: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('progres', 'errored', 'successed'),
      allowNull: true,
    },
    error_info: {
      type: DataTypes.JSON,
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
