import { DataTypes } from 'sequelize';
import { sequelize } from '../db/index.js';

const User = sequelize.define(
  'User',
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true
    },
    firstName: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'first_name'
    },
    lastName: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'last_name'
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true
      },
      field: 'email'
    },
    passwordHash: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'password_hash'
    },

    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
      field: 'phone'
    },
    addressStreet: {
      type: DataTypes.STRING(200),
      allowNull: true,
      field: 'address_street'
    },
    addressCity: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'address_city'
    },
    addressState: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'address_state'
    },
    addressZipCode: {
      type: DataTypes.STRING(10),
      allowNull: true,
      field: 'address_zip_code'
    },
    addressCountry: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: 'India',
      field: 'address_country'
    },
    preferences: {
      type: DataTypes.JSON,
      allowNull: true,
      field: 'preferences'
    },
    screenIds: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'screen_id'
    },
    editRights: {
      type: DataTypes.JSON,
      allowNull: true,
      field: 'edit_rights'
    },
    isAdmin: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_admin',
      get() {
        const rawValue = this.getDataValue('isAdmin');
        return Boolean(rawValue);
      },
      set(value) {
        this.setDataValue('isAdmin', value ? 1 : 0);
      }
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_active',
      get() {
        const rawValue = this.getDataValue('isActive');
        return Boolean(rawValue);
      },
      set(value) {
        this.setDataValue('isActive', value ? 1 : 0);
      }
    },
    lastLoginAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_login_at'
    },
    resetPasswordOtp: {
      type: DataTypes.STRING(10),
      allowNull: true,
      field: 'reset_password_otp'
    },
    resetPasswordOtpExpiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'reset_password_otp_expires_at'
    },
    selectedStoreId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      field: 'selected_store_id'
    },
    createdBy: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      field: 'created_by'
    }
  },
  {
    tableName: 'users',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
);

export default User;


