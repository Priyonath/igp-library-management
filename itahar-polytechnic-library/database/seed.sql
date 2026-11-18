-- =====================================================================
-- ITAHAR GOVERNMENT POLYTECHNIC - COLLEGE LIBRARY MANAGEMENT SYSTEM
-- Comprehensive Production Seed Data (MySQL 8.0+)
-- =====================================================================

USE `itahar_library`;

-- Disable foreign key checks during seeding
SET FOREIGN_KEY_CHECKS = 0;

-- 1. SEED ROLES
INSERT INTO `roles` (`id`, `name`, `description`) VALUES
(1, 'admin', 'System Administrator with full institutional authority'),
(2, 'librarian', 'Chief Librarian & Circulation Officer'),
(3, 'student', 'Enrolled Polytechnic Student')
ON DUPLICATE KEY UPDATE `description` = VALUES(`description`);

-- 2. SEED USERS (Password for all seed accounts: Password@123)
-- Hash: $2b$10$acrN.kXRNn8FV2uT82awJeonzAQ.IFtSnl1JoAjEqMKIszsJVPeSm
INSERT INTO `users` (`id`, `role_id`, `student_id`, `name`, `email`, `password_hash`, `phone`, `department`, `semester`, `status`) VALUES
(1, 1, NULL, 'Dr. B. K. Sarkar (Principal/Admin)', 'admin@itaharpolytechnic.edu.in', '$2b$10$acrN.kXRNn8FV2uT82awJeonzAQ.IFtSnl1JoAjEqMKIszsJVPeSm', '+91 9832100001', 'Administration', NULL, 'active'),
(2, 2, NULL, 'Smt. Ananya Roy (Librarian)', 'librarian@itaharpolytechnic.edu.in', '$2b$10$acrN.kXRNn8FV2uT82awJeonzAQ.IFtSnl1JoAjEqMKIszsJVPeSm', '+91 9832100002', 'Library Science', NULL, 'active'),
(3, 3, 'CS-2026-012', 'Sarah Jenkins', 'sarah.cs@itaharpolytechnic.edu.in', '$2b$10$acrN.kXRNn8FV2uT82awJeonzAQ.IFtSnl1JoAjEqMKIszsJVPeSm', '+91 9832100012', 'Computer Science & Technology', 'Semester 4', 'active'),
(4, 3, 'EE-2026-045', 'David Miller', 'david.ee@itaharpolytechnic.edu.in', '$2b$10$acrN.kXRNn8FV2uT82awJeonzAQ.IFtSnl1JoAjEqMKIszsJVPeSm', '+91 9832100045', 'Electrical Engineering', 'Semester 4', 'active'),
(5, 3, 'CS-2026-104', 'Marcus Vance', 'marcus.cs@itaharpolytechnic.edu.in', '$2b$10$acrN.kXRNn8FV2uT82awJeonzAQ.IFtSnl1JoAjEqMKIszsJVPeSm', '+91 9832100104', 'Computer Science & Technology', 'Semester 2', 'active'),
(6, 3, 'ET-2026-029', 'Priya Sharma', 'priya.etce@itaharpolytechnic.edu.in', '$2b$10$acrN.kXRNn8FV2uT82awJeonzAQ.IFtSnl1JoAjEqMKIszsJVPeSm', '+91 9832100029', 'Electronics & Telecommunication', 'Semester 3', 'active'),
(7, 3, 'CS-2026-155', 'Rohan Das (Pending Approval)', 'rohan.pending@itaharpolytechnic.edu.in', '$2b$10$acrN.kXRNn8FV2uT82awJeonzAQ.IFtSnl1JoAjEqMKIszsJVPeSm', '+91 9832100155', 'Computer Science & Technology', 'Semester 1', 'pending'),
(8, 3, 'ME-2026-088', 'Amit Sen (Pending Approval)', 'amit.pending@itaharpolytechnic.edu.in', '$2b$10$acrN.kXRNn8FV2uT82awJeonzAQ.IFtSnl1JoAjEqMKIszsJVPeSm', '+91 9832100088', 'Mechanical Engineering', 'Semester 1', 'pending')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- 3. SEED CATEGORIES
INSERT INTO `categories` (`id`, `name`, `code`, `description`) VALUES
(1, 'Computer Science & Technology', 'CST', 'Computing, algorithms, software engineering, OS and networks'),
(2, 'Electrical Engineering', 'EE', 'Power systems, circuits, machines and electrical technology'),
(3, 'Electronics & Telecommunication', 'ETCE', 'Microprocessors, VLSI, digital signals and communications'),
(4, 'Mechanical Engineering', 'ME', 'Thermodynamics, mechanics, fluid power and manufacturing'),
(5, 'Civil Engineering', 'CE', 'Structures, surveying, geotechnical and environmental engineering'),
(6, 'Mathematics', 'MATH', 'Applied engineering mathematics, calculus and linear algebra'),
(7, 'Physics', 'PHY', 'Engineering physics, optics, electromagnetic theory'),
(8, 'Humanities & Management', 'HUM', 'Technical communication, ethics and management')
ON DUPLICATE KEY UPDATE `description` = VALUES(`description`);

-- 4. SEED AUTHORS
INSERT INTO `authors` (`id`, `name`, `biography`) VALUES
(1, 'E. Balagurusamy', 'Former Vice Chancellor, Anna University and prominent author in computing'),
(2, 'Abraham Silberschatz & Peter B. Galvin', 'Pioneering authors on Operating Systems and Database architectures'),
(3, 'Henry F. Korth & S. Sudarshan', 'World-renowned textbook authors on relational database systems'),
(4, 'B.L. Theraja & A.K. Theraja', 'Authors of standard reference textbooks in Electrical Technology in Asia'),
(5, 'B.S. Grewal', 'Eminent mathematician and author of Higher Engineering Mathematics'),
(6, 'Philip Kotler', 'Distinguished Professor of International Marketing at Kellogg School'),
(7, 'Hugh D. Young & Roger A. Freedman', 'Renowned authors of University Physics with Modern Physics'),
(8, 'Stuart Russell & Peter Norvig', 'Leading authorities on Artificial Intelligence and robotics'),
(9, 'Andrew S. Tanenbaum', 'Pioneer in distributed computing and Computer Networks')
ON DUPLICATE KEY UPDATE `biography` = VALUES(`biography`);

-- 5. SEED PUBLISHERS
INSERT INTO `publishers` (`id`, `name`, `address`, `contact_email`) VALUES
(1, 'McGraw-Hill Education', 'New York & New Delhi', 'info@mheducation.com'),
(2, 'Pearson Education', 'London & Noida, India', 'support@pearson.com'),
(3, 'S. Chand & Company', 'Ram Nagar, New Delhi', 'info@schandpublishing.com'),
(4, 'Khanna Publishers', 'Nai Sarak, Delhi', 'contact@khannapublishers.in'),
(5, 'Wiley India Pvt Ltd', 'New Delhi', 'csupport@wiley.com'),
(6, 'Oxford University Press', 'YMCA Library Building, New Delhi', 'inquiries@oup.com')
ON DUPLICATE KEY UPDATE `address` = VALUES(`address`);

-- 6. SEED BOOKS
INSERT INTO `books` (`id`, `title`, `isbn`, `category_id`, `author_id`, `publisher_id`, `edition`, `publication_year`, `call_number`, `total_copies`, `available_copies`, `description`, `cover_url`) VALUES
(1, 'Data Structures and Algorithms in C++', '978-0070141698', 1, 1, 1, '4th Edition', 2021, 'QA76.73.C153', 5, 5, 'Comprehensive coverage of linear and non-linear data structures, trees, graphs, sorting, and algorithmic complexities with modern C++ examples.', NULL),
(2, 'Operating System Concepts', '978-1118063330', 1, 2, 5, '10th Edition', 2020, 'QA76.76.O63', 4, 3, 'The definitive guide to operating system fundamentals, processes, thread synchronization, memory management, and file system architectures.', NULL),
(3, 'Database System Concepts', '978-0073523323', 1, 3, 1, '7th Edition', 2022, 'QA76.9.D3', 6, 6, 'Foundations of database management, SQL, relational calculus, normalization, transaction processing, indexing, and NoSQL engines.', NULL),
(4, 'Basic Electrical Engineering', '978-8121924405', 2, 4, 3, 'Revised Multicolor Ed', 2021, 'TK146.T44', 5, 5, 'Comprehensive textbook covering DC circuits, AC principles, transformers, electromagnetic induction, and three-phase rotating machines.', NULL),
(5, 'Higher Engineering Mathematics Vol 1', '978-8174091955', 6, 5, 4, '44th Edition', 2020, 'QA300.G74', 8, 7, 'Standard reference text for polytechnic and engineering students covering differential equations, vector calculus, and matrices.', NULL),
(6, 'Principles of Marketing', '978-0132167123', 8, 6, 2, '17th Edition', 2019, 'HF5415.K67', 3, 3, 'Core framework of contemporary marketing strategy, consumer analysis, brand positioning, and digital commerce principles.', NULL),
(7, 'University Physics with Modern Physics', '978-0321973610', 7, 7, 2, '14th Edition', 2021, 'QC21.3.Y68', 4, 4, 'In-depth engineering physics covering classical mechanics, thermodynamics, wave optics, electricity, magnetism, and quantum physics.', NULL),
(8, 'Artificial Intelligence: A Modern Approach', '978-0136042594', 1, 8, 2, '4th Edition', 2022, 'Q335.R87', 4, 4, 'The preeminent textbook in AI detailing heuristic search, machine learning, deep neural networks, logic, and intelligent agents.', NULL),
(9, 'Computer Networks: Principles and Protocols', '978-0132126953', 1, 9, 2, '5th Edition', 2021, 'TK5105.5.T36', 5, 5, 'Definitive guide on layered network protocols, Ethernet, TCP/IP stack, wireless routing, network security, and socket programming.', NULL)
ON DUPLICATE KEY UPDATE `title` = VALUES(`title`);

-- 7. SEED BOOK COPIES
INSERT INTO `book_copies` (`id`, `book_id`, `barcode`, `copy_number`, `status`, `shelf_location`, `condition_status`) VALUES
-- Book 1 (5 copies)
(1, 1, 'ITP-CS-00101', 1, 'available', 'Stack CS-101', 'Good'),
(2, 1, 'ITP-CS-00102', 2, 'available', 'Stack CS-101', 'Good'),
(3, 1, 'ITP-CS-00103', 3, 'available', 'Stack CS-101', 'Good'),
(4, 1, 'ITP-CS-00104', 4, 'available', 'Stack CS-101', 'Fair'),
(5, 1, 'ITP-CS-00105', 5, 'available', 'Stack CS-101', 'New'),
-- Book 2 (4 copies, 1 issued)
(6, 2, 'ITP-CS-00201', 1, 'issued', 'Stack CS-102', 'Good'),
(7, 2, 'ITP-CS-00202', 2, 'available', 'Stack CS-102', 'Good'),
(8, 2, 'ITP-CS-00203', 3, 'available', 'Stack CS-102', 'Good'),
(9, 2, 'ITP-CS-00204', 4, 'available', 'Stack CS-102', 'New'),
-- Book 3 (6 copies)
(10, 3, 'ITP-CS-00301', 1, 'available', 'Stack CS-103', 'Good'),
(11, 3, 'ITP-CS-00302', 2, 'available', 'Stack CS-103', 'Good'),
(12, 3, 'ITP-CS-00303', 3, 'available', 'Stack CS-103', 'New'),
(13, 3, 'ITP-CS-00304', 4, 'available', 'Stack CS-103', 'Good'),
(14, 3, 'ITP-CS-00305', 5, 'available', 'Stack CS-103', 'Good'),
(15, 3, 'ITP-CS-00306', 6, 'available', 'Stack CS-103', 'Fair'),
-- Book 4 (5 copies)
(16, 4, 'ITP-EE-00401', 1, 'available', 'Stack EE-201', 'Good'),
(17, 4, 'ITP-EE-00402', 2, 'available', 'Stack EE-201', 'Good'),
(18, 4, 'ITP-EE-00403', 3, 'available', 'Stack EE-201', 'Good'),
(19, 4, 'ITP-EE-00404', 4, 'available', 'Stack EE-201', 'New'),
(20, 4, 'ITP-EE-00405', 5, 'available', 'Stack EE-201', 'Good'),
-- Book 5 (8 copies, 1 issued/overdue)
(21, 5, 'ITP-MA-00501', 1, 'issued', 'Stack MA-301', 'Good'),
(22, 5, 'ITP-MA-00502', 2, 'available', 'Stack MA-301', 'Good'),
(23, 5, 'ITP-MA-00503', 3, 'available', 'Stack MA-301', 'Good'),
(24, 5, 'ITP-MA-00504', 4, 'available', 'Stack MA-301', 'Good'),
(25, 5, 'ITP-MA-00505', 5, 'available', 'Stack MA-301', 'New'),
(26, 5, 'ITP-MA-00506', 6, 'available', 'Stack MA-301', 'Good'),
(27, 5, 'ITP-MA-00507', 7, 'available', 'Stack MA-301', 'Fair'),
(28, 5, 'ITP-MA-00508', 8, 'available', 'Stack MA-301', 'Good'),
-- Book 6 (3 copies)
(29, 6, 'ITP-HM-00601', 1, 'available', 'Stack HM-401', 'Good'),
(30, 6, 'ITP-HM-00602', 2, 'available', 'Stack HM-401', 'Good'),
(31, 6, 'ITP-HM-00603', 3, 'available', 'Stack HM-401', 'New'),
-- Book 7 (4 copies)
(32, 7, 'ITP-PH-00701', 1, 'available', 'Stack PH-501', 'Good'),
(33, 7, 'ITP-PH-00702', 2, 'available', 'Stack PH-501', 'Good'),
(34, 7, 'ITP-PH-00703', 3, 'available', 'Stack PH-501', 'New'),
(35, 7, 'ITP-PH-00704', 4, 'available', 'Stack PH-501', 'Good'),
-- Book 8 (4 copies)
(36, 8, 'ITP-CS-00801', 1, 'available', 'Stack CS-104', 'Good'),
(37, 8, 'ITP-CS-00802', 2, 'available', 'Stack CS-104', 'Good'),
(38, 8, 'ITP-CS-00803', 3, 'available', 'Stack CS-104', 'Good'),
(39, 8, 'ITP-CS-00804', 4, 'available', 'Stack CS-104', 'New'),
-- Book 9 (5 copies)
(40, 9, 'ITP-CS-00901', 1, 'available', 'Stack CS-105', 'Good'),
(41, 9, 'ITP-CS-00902', 2, 'available', 'Stack CS-105', 'Good'),
(42, 9, 'ITP-CS-00903', 3, 'available', 'Stack CS-105', 'New'),
(43, 9, 'ITP-CS-00904', 4, 'available', 'Stack CS-105', 'Good'),
(44, 9, 'ITP-CS-00905', 5, 'available', 'Stack CS-105', 'Good')
ON DUPLICATE KEY UPDATE `shelf_location` = VALUES(`shelf_location`);

-- 8. SEED LOANS
-- Sarah Jenkins has Book 2 (Operating System Concepts) checked out
INSERT INTO `loans` (`id`, `book_id`, `copy_id`, `user_id`, `issued_by`, `issue_date`, `due_date`, `return_date`, `returned_to`, `status`, `renewal_count`, `notes`) VALUES
(1, 2, 6, 3, 2, DATE_SUB(CURRENT_DATE(), INTERVAL 5 DAY), DATE_ADD(CURRENT_DATE(), INTERVAL 9 DAY), NULL, NULL, 'active', 0, 'Issued for Operating Systems Lab Assignment'),
-- David Miller has Book 5 (Engineering Mathematics) overdue
(2, 5, 21, 4, 2, DATE_SUB(CURRENT_DATE(), INTERVAL 20 DAY), DATE_SUB(CURRENT_DATE(), INTERVAL 6 DAY), NULL, NULL, 'overdue', 0, 'Overdue - automatic reminder sent'),
-- Previous returned loan by Marcus Vance
(3, 1, 1, 5, 2, DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY), DATE_SUB(CURRENT_DATE(), INTERVAL 16 DAY), DATE_SUB(CURRENT_DATE(), INTERVAL 18 DAY), 2, 'returned', 0, 'Returned in excellent condition')
ON DUPLICATE KEY UPDATE `status` = VALUES(`status`);

-- 9. SEED FINES
-- Fine for loan 2 (6 days overdue at Rs. 2.00/day = Rs. 12.00)
INSERT INTO `fines` (`id`, `loan_id`, `user_id`, `amount`, `overdue_days`, `status`, `reason`) VALUES
(1, 2, 4, 12.00, 6, 'unpaid', 'Overdue fine for Higher Engineering Mathematics Vol 1 (6 days overdue)')
ON DUPLICATE KEY UPDATE `amount` = VALUES(`amount`);

-- 10. SEED RESERVATIONS
INSERT INTO `reservations` (`id`, `book_id`, `user_id`, `reservation_date`, `expiry_date`, `status`) VALUES
(1, 2, 5, CURRENT_TIMESTAMP(), DATE_ADD(CURRENT_DATE(), INTERVAL 7 DAY), 'pending')
ON DUPLICATE KEY UPDATE `status` = VALUES(`status`);

-- 11. SEED BOOK REQUESTS
INSERT INTO `book_requests` (`id`, `user_id`, `title`, `author`, `publisher`, `isbn`, `reason`, `status`, `admin_remarks`, `reviewed_by`) VALUES
(1, 3, 'Clean Architecture: A Craftsman\'s Guide', 'Robert C. Martin', 'Prentice Hall', '978-0134494166', 'Required for Semester 4 Advanced Software Engineering seminar', 'approved', 'Approved by Library Committee. Recommended for next procurement batch.', 2),
(2, 6, 'VLSI Design Techniques for Analog and Digital Circuits', 'Geiger, Allen, Strader', 'McGraw-Hill', '978-0070232532', 'Essential for ETCE final semester project work', 'pending', NULL, NULL)
ON DUPLICATE KEY UPDATE `title` = VALUES(`title`);

-- 12. SEED E_RESOURCES
INSERT INTO `e_resources` (`id`, `title`, `resource_type`, `category_id`, `author`, `external_url`, `description`, `uploaded_by`) VALUES
(1, 'IEEE Xplore Digital Library', 'journal', 1, 'IEEE Consortium', 'https://ieeexplore.ieee.org', 'Institutional portal access to over 5M scientific research papers in electrical, computer science, and engineering.', 2),
(2, 'SpringerLink Research Archive', 'journal', 1, 'Springer Nature', 'https://link.springer.com', 'Comprehensive peer-reviewed articles, eBooks, engineering manuals and computer science lecture notes.', 2),
(3, 'ACM Digital Library', 'paper', 1, 'Association for Computing Machinery', 'https://dl.acm.org', 'World\'s largest computing educational dataset, conference proceedings, algorithms and AI publications.', 2),
(4, 'NPTEL Computer Science Course Repository', 'lecture_notes', 1, 'IIT Kharagpur / MHRD', 'https://nptel.ac.in/courses', 'National Programme on Technology Enhanced Learning free high-definition video lectures and study notes.', 2),
(5, 'WBSCTE Polytechnic Curriculum Syllabus (CST, EE, ETCE)', 'syllabus', 1, 'West Bengal State Council of Technical Education', 'https://webscte.co.in', 'Official diploma semester-wise curriculum syllabus, question banks and laboratory manuals.', 2)
ON DUPLICATE KEY UPDATE `title` = VALUES(`title`);

-- 13. SEED NOTICES
INSERT INTO `notices` (`id`, `title`, `content`, `category`, `is_pinned`, `target_role`, `created_by`) VALUES
(1, 'New Digital Library Access Protocols & Wi-Fi Configuration', 'All students can now access IEEE Xplore and SpringerLink directly through the campus Wi-Fi without additional proxy logins. For off-campus VPN access, register your institutional student ID with the central library desk.', 'general', 1, 'all', 1),
(2, 'Upcoming Semester Examination Book Bank Scheme', 'Applications are open for Book Bank allocations for 2nd and 4th semester students. Qualified applicants can collect full-semester textbook sets on Monday from 10:00 AM to 3:00 PM.', 'circulation', 1, 'student', 2),
(3, 'Library Hours Extension for End-Semester Preparation', 'The Central Reading Hall will remain open until 8:00 PM on all weekdays throughout the upcoming examination period. Silence must be observed at all times.', 'exam', 0, 'all', 2)
ON DUPLICATE KEY UPDATE `title` = VALUES(`title`);

-- 14. SEED NOTIFICATIONS
INSERT INTO `notifications` (`id`, `user_id`, `title`, `message`, `type`, `is_read`, `action_url`) VALUES
(1, 3, 'Book Due Soon Alert', 'Reminder: "Operating System Concepts" is due in 9 days. You can renew online if no reservations are pending.', 'due_alert', 0, '#tab-student'),
(2, 4, 'Overdue Book & Fine Notice', 'URGENT: "Higher Engineering Mathematics Vol 1" is 6 days overdue. Accumulated fine is Rs. 12.00. Please return immediately.', 'warning', 0, '#tab-student'),
(3, 5, 'Book Reservation Queued', 'Your reservation for "Operating System Concepts" is queued. You will be alerted when a copy is checked in.', 'info', 1, '#tab-student'),
(4, 7, 'Registration Received', 'Your registration is pending approval by the college administrator. You will receive access once verified.', 'approval', 0, '#')
ON DUPLICATE KEY UPDATE `title` = VALUES(`title`);

-- 15. SEED SYSTEM SETTINGS
INSERT INTO `system_settings` (`id`, `setting_key`, `setting_value`, `description`, `updated_by`) VALUES
(1, 'max_loan_days', '14', 'Maximum standard borrowing duration in days', 1),
(2, 'daily_fine_rate', '2.00', 'Fine amount in INR per overdue day', 1),
(3, 'max_books_per_student', '3', 'Maximum simultaneous books a student can borrow', 1),
(4, 'max_renewals', '1', 'Maximum times a book loan can be renewed', 1),
(5, 'college_name', 'ITAHAR GOVERNMENT POLYTECHNIC', 'Official College Institution Name', 1),
(6, 'academic_session', '2026-2027', 'Current active academic session', 1)
ON DUPLICATE KEY UPDATE `setting_value` = VALUES(`setting_value`);

-- 16. SEED ACTIVITY LOGS
INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `entity_type`, `entity_id`, `details`, `ip_address`) VALUES
(1, 1, 'SYSTEM_INIT', 'SYSTEM', 1, 'Library Management System database initialized with production seed data', '127.0.0.1'),
(2, 2, 'BOOK_ISSUE', 'LOAN', 1, 'Issued "Operating System Concepts" (Barcode: ITP-CS-00201) to student Sarah Jenkins (CS-2026-012)', '127.0.0.1'),
(3, 2, 'BOOK_RETURN', 'LOAN', 3, 'Processed return of "Data Structures and Algorithms in C++" from Marcus Vance', '127.0.0.1')
ON DUPLICATE KEY UPDATE `action` = VALUES(`action`);

SET FOREIGN_KEY_CHECKS = 1;
