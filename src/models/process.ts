import { DataTypes } from 'sequelize';
import { AppDataSource } from '../config';

export const Process = AppDataSource.define(
  'process',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    description: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    process_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    fileName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    error_fileName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('open', 'progress', 'completed', 'is_failed'),
      allowNull: false,
    },
    error_status: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    error_message: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    updated_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: 'process',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
);
