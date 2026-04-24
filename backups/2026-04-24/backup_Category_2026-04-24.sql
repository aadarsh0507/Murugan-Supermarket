-- Table Backup: Category
-- Database: Super_Market
-- Date: 2026-04-24
-- Generated: 2026-04-24T14:41:06.898Z

SET FOREIGN_KEY_CHECKS=0;

-- Table structure for table `Category`
DROP TABLE IF EXISTS `Category`;
CREATE TABLE `Category` (
  `CategoryCode` int NOT NULL,
  `Description` text,
  `CreationDate` text,
  `CreatedbyUser` text,
  `ModifiedbyUser` text,
  `ModifiedDate` text,
  `IsActive` int DEFAULT NULL,
  `store_id` int unsigned DEFAULT NULL,
  `IsImported` text,
  `FileName` text,
  `ImportedDate` text,
  `OldCode` text,
  `MasterId` int DEFAULT NULL,
  `CommissionPercentage` int DEFAULT NULL,
  `Classification` int DEFAULT NULL,
  `AllowBilling` int DEFAULT NULL,
  `MaintainSingleQty` int DEFAULT NULL,
  `DefaultPurchaseTax` text,
  `DefaultSalesTax` text,
  `AllowAdjustment` int DEFAULT NULL,
  `SyncId` text,
  `ProductHandlingMethod` text,
  `ReferenceProductCode` text,
  `SeriesName` text,
  PRIMARY KEY (`CategoryCode`),
  KEY `idx_store_id` (`store_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Dumping data for table `Category` (3 rows)
LOCK TABLES `Category` WRITE;
INSERT INTO `Category` (`CategoryCode`, `Description`, `CreationDate`, `CreatedbyUser`, `ModifiedbyUser`, `ModifiedDate`, `IsActive`, `store_id`, `IsImported`, `FileName`, `ImportedDate`, `OldCode`, `MasterId`, `CommissionPercentage`, `Classification`, `AllowBilling`, `MaintainSingleQty`, `DefaultPurchaseTax`, `DefaultSalesTax`, `AllowAdjustment`, `SyncId`, `ProductHandlingMethod`, `ReferenceProductCode`, `SeriesName`) VALUES (1, 'Health drinks', '2026-04-19 06:31:44', '11', NULL, NULL, 1, 2, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO `Category` (`CategoryCode`, `Description`, `CreationDate`, `CreatedbyUser`, `ModifiedbyUser`, `ModifiedDate`, `IsActive`, `store_id`, `IsImported`, `FileName`, `ImportedDate`, `OldCode`, `MasterId`, `CommissionPercentage`, `Classification`, `AllowBilling`, `MaintainSingleQty`, `DefaultPurchaseTax`, `DefaultSalesTax`, `AllowAdjustment`, `SyncId`, `ProductHandlingMethod`, `ReferenceProductCode`, `SeriesName`) VALUES (2, 'Biscuits', '2026-04-19 07:16:28', '12', NULL, NULL, 1, 2, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO `Category` (`CategoryCode`, `Description`, `CreationDate`, `CreatedbyUser`, `ModifiedbyUser`, `ModifiedDate`, `IsActive`, `store_id`, `IsImported`, `FileName`, `ImportedDate`, `OldCode`, `MasterId`, `CommissionPercentage`, `Classification`, `AllowBilling`, `MaintainSingleQty`, `DefaultPurchaseTax`, `DefaultSalesTax`, `AllowAdjustment`, `SyncId`, `ProductHandlingMethod`, `ReferenceProductCode`, `SeriesName`) VALUES (3, 'Redcarpet', '2026-04-24 12:33:15', '14', NULL, NULL, 1, 2, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
UNLOCK TABLES;

SET FOREIGN_KEY_CHECKS=1;
