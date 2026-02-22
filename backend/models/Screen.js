import { DataTypes } from 'sequelize';
import { sequelize } from '../db/index.js';

const Screen = sequelize.define(
    'Screen',
    {
        id: {
            type: DataTypes.INTEGER.UNSIGNED,
            primaryKey: true,
        },
        screenName: {
            type: DataTypes.STRING(100),
            allowNull: false,
            field: 'screen_name',
        },
        isActive: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true,
            field: 'is_active',
            get() {
                return Boolean(this.getDataValue('isActive'));
            },
            set(value) {
                this.setDataValue('isActive', value ? 1 : 0);
            },
        },
    },
    {
        tableName: 'screens',
        timestamps: false,
    }
);

export default Screen;

