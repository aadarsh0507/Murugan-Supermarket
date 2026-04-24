-- Table Backup: Subcategory
-- Database: Super_Market
-- Date: 2026-04-24
-- Generated: 2026-04-24T14:41:12.298Z

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

-- Dumping data for table `Subcategory` (5 rows)
LOCK TABLES `Subcategory` WRITE;
INSERT INTO `Subcategory` (`SubCategoryCode`, `Description`, `ParentId`, `CreationDate`, `CreatedbyUser`, `ModifiedbyUser`, `ModifiedDate`, `IsActive`, `store_id`, `IsImported`, `FileName`, `ImportedDate`, `OldCode`, `MasterId`, `SyncId`) VALUES (1, 'Horlicks', 1, '2026-04-19 06:34:42', '11', NULL, NULL, 1, 2, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO `Subcategory` (`SubCategoryCode`, `Description`, `ParentId`, `CreationDate`, `CreatedbyUser`, `ModifiedbyUser`, `ModifiedDate`, `IsActive`, `store_id`, `IsImported`, `FileName`, `ImportedDate`, `OldCode`, `MasterId`, `SyncId`) VALUES (2, 'Cream Biscuits', 2, '2026-04-19 07:16:54', '12', NULL, NULL, 1, 2, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO `Subcategory` (`SubCategoryCode`, `Description`, `ParentId`, `CreationDate`, `CreatedbyUser`, `ModifiedbyUser`, `ModifiedDate`, `IsActive`, `store_id`, `IsImported`, `FileName`, `ImportedDate`, `OldCode`, `MasterId`, `SyncId`) VALUES (3, 'Boost', 1, '2026-04-20 05:09:20', '1', NULL, NULL, 1, 2, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO `Subcategory` (`SubCategoryCode`, `Description`, `ParentId`, `CreationDate`, `CreatedbyUser`, `ModifiedbyUser`, `ModifiedDate`, `IsActive`, `store_id`, `IsImported`, `FileName`, `ImportedDate`, `OldCode`, `MasterId`, `SyncId`) VALUES (4, 'Test', 2, '2026-04-24 13:33:52', '12', NULL, NULL, 1, 2, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO `Subcategory` (`SubCategoryCode`, `Description`, `ParentId`, `CreationDate`, `CreatedbyUser`, `ModifiedbyUser`, `ModifiedDate`, `IsActive`, `store_id`, `IsImported`, `FileName`, `ImportedDate`, `OldCode`, `MasterId`, `SyncId`) VALUES (5, 'test', 3, '2026-04-24 13:39:32', '12', NULL, NULL, 1, 2, NULL, NULL, NULL, NULL, NULL, NULL);
UNLOCK TABLES;

SET FOREIGN_KEY_CHECKS=1;
