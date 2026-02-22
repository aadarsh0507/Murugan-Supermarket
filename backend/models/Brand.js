import { DataTypes } from 'sequelize';
import { sequelize } from '../db/index.js';

const Brand = sequelize.define(
    'Brand',
    {
        brandCode: {
            type: DataTypes.STRING(50),
            allowNull: false,
            primaryKey: true,
            field: 'BrandCode'
        },
        description: {
            type: DataTypes.STRING(200),
            allowNull: true,
            field: 'Description'
        },
        isActive: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true,
            field: 'IsActive',
            get() {
                const rawValue = this.getDataValue('isActive');
                return Boolean(rawValue);
            },
            set(value) {
                this.setDataValue('isActive', value ? 1 : 0);
            }
        },
        storeId: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: true,
            field: 'store_id'
        }
    },
    {
        tableName: 'Brand',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                fields: ['store_id'],
                name: 'idx_store_id'
            },
            {
                fields: ['IsActive'],
                name: 'idx_is_active'
            }
        ]
    }
);

export default Brand;

