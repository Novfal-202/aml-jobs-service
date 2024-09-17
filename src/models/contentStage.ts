import { DataTypes } from 'sequelize';
import { AppDataSource } from '../config';

export const ContentStage = AppDataSource.define(
  'content_stage',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    process_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    content_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    description: {
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
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
    },
    L3_skill: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
    },
    sub_skills: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
    },
    gradient: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    media: {
      type: DataTypes.JSONB,
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
    tableName: 'content_stage',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
);
