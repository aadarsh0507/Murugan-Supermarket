-- Table Backup: Subcategory
-- Database: Super_Market
-- Date: 2026-03-28
-- Generated: 2026-03-28T17:51:16.029Z

SET FOREIGN_KEY_CHECKS=0;

-- Table structure for table `Subcategory`
DROP TABLE IF EXISTS `Subcategory`;
CREATE TABLE `Subcategory` (
  `SubCategoryCode` int NOT NULL,
  `Description` text,
  `ParentId` int DEFAULT NULL,
  `CreationDate` text,
  `CreatedbyUser` text,
  `ModifiedbyUser` text,
  `ModifiedDate` text,
  `IsActive` int DEFAULT NULL,
  `store_id` int unsigned DEFAULT NULL,
  `IsImported` int DEFAULT NULL,
  `FileName` text,
  `ImportedDate` text,
  `OldCode` text,
  `MasterId` int DEFAULT NULL,
  `SyncId` text,
  PRIMARY KEY (`SubCategoryCode`),
  KEY `idx_store_id` (`store_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Dumping data for table `Subcategory` (1 rows)
LOCK TABLES `Subcategory` WRITE;
INSERT INTO `Subcategory` (`SubCategoryCode`, `Description`, `ParentId`, `CreationDate`, `CreatedbyUser`, `ModifiedbyUser`, `ModifiedDate`, `IsActive`, `store_id`, `IsImported`, `FileName`, `ImportedDate`, `OldCode`, `MasterId`, `SyncId`) VALUES (1, 'Test 1', 1, '2026-03-28 17:07:38', '12', NULL, NULL, 1, 2, NULL, NULL, NULL, NULL, NULL, NULL);
UNLOCK TABLES;

SET FOREIGN_KEY_CHECKS=1;
