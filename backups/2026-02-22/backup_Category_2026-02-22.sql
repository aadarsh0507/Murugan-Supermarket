-- Table Backup: Category
-- Database: Super_Market
-- Date: 2026-02-22
-- Generated: 2026-02-22T14:36:37.912Z

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

-- Table `Category` is empty

SET FOREIGN_KEY_CHECKS=1;
