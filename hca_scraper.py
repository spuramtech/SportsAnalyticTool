"""
HCA First-Class Cricket Archive Scraper
Fetches all player pages from hycricket.org and stores in SQLite.
"""

import sqlite3
import time
import re
import requests
from bs4 import BeautifulSoup

BASE_URL = "https://www.hycricket.org/HCA/"
DB_PATH = r"d:\Personal\R&D\hca_players.db"
DELAY = 0.5  # seconds between requests

# All player entries from fc-archive.htm — deduplicated by URL below
RAW_PLAYERS = [
    (1, "A Chatterjee", "hyd_fc/fc_84-03/a_chatterjee.htm"),
    (2, "Abbas Ali Baig", "hyd_fc/fc_34-83/aa_baig.htm"),
    (3, "Abbas Ali Khan", "hyd_fc/fc_84-03/abbas_ali_khan.htm"),
    (4, "Abdul Azeem", "hyd_fc/fc_34-83/a_azeem.htm"),
    (5, "Mohammad Abdul Hai", "hyd_fc/fc_34-83/m_abdul_hai.htm"),
    (6, "Mohammad Abdul Khader", "hyd_fc/fc_04-08/m_abdul_khader.htm"),
    (7, "Abdul Majid", "hyd_fc/fc_34-83/a_majid.htm"),
    (8, "Abdul Raoof", "hyd_fc/fc_34-83/a_raoof.htm"),
    (9, "Abdul Wahab", "hyd_fc/fc_34-83/abdul_wahab.htm"),
    (10, "Abdullah", "hyd_fc/fc_34-83/abdullah.htm"),
    (11, "Abhinav Kumar", "hyd_fc/fc_04-08/abhinav_kumar.htm"),
    (12, "Syed Abid Ali", "hyd_fc/fc_34-83/s_abid_ali.htm"),
    (13, "Abrar Ahmed", "hyd_fc/fc_84-03/abrar_ahmed.htm"),
    (14, "Alfred Absolem", "hyd_fc/fc_04-08/a_absolem.htm"),
    (15, "Afzal Ali", "hyd_fc/fc_34-83/afzal_ali.htm"),
    (16, "Ahmed Khan Rafiuddin", "hyd_fc/fc_34-83/ak_rafiuddin.htm"),
    (17, "Edulji Bujorji Aibara", "hyd_fc/fc_34-83/eb_aibara.htm"),
    (18, "Faridoon S Aibara", "hyd_fc/fc_34-83/fs_aibara.htm"),
    (19, "Akkaraju Lalith Mohan", "hyd_fc/fc_04-08/a_lalith_mohan.htm"),
    (21, "S Ali Abbas", "hyd_fc/fc_34-83/s_ali_abbas.htm"),
    (22, "Ali Hussain", "hyd_fc/fc_34-83/ali_hussain.htm"),
    (23, "Alladi Raju", "hyd_fc/fc_34-83/a_raju.htm"),
    (24, "Ambati Thirupathi Rayudu", "hyd_fc/fc_84-03/at_rayudu.htm"),
    (25, "Mir Amir Ali", "hyd_fc/fc_34-83/m_amir_ali.htm"),
    (26, "Ammanabrole Nand Kishore", "hyd_fc/fc_84-03/a_nand_kishore.htm"),
    (27, "Amol Shinde", "hyd_fc/fc_04-08/a_shinde.htm"),
    (28, "Amritsar Govindsingh Kripal Singh", "hyd_fc/fc_34-83/ag_kripal_singh.htm"),
    (29, "Anirudh Singh", "hyd_fc/fc_84-03/anirudh_singh.htm"),
    (30, "AR Bhupathi", "hyd_fc/fc_34-83/ar_bhupathy.htm"),
    (31, "Dayanand Archaye", "hyd_fc/fc_34-83/dayanand_archaye.htm"),
    (32, "Arif Rabbani", "hyd_fc/fc_34-83/a_rabbani.htm"),
    (33, "Arjun Praneet Munagala", "hyd_fc/fc_04-08/ap_munagala.htm"),
    (34, "Arjun Shivlal Yadav", "hyd_fc/fc_84-03/as_yadav.htm"),
    (35, "Arshad Ayub", "hyd_fc/fc_34-83/arshad_ayub.htm"),
    (36, "Arun Paul", "hyd_fc/fc_34-83/a_paul.htm"),
    (37, "Gangashetty Arvind Kumar", "hyd_fc/fc_84-03/g_arvind_kumar.htm"),
    (38, "Dharmapuri Arvind", "hyd_fc/fc_84-03/d_arvind.htm"),
    (39, "Asadullah Qureshi", "hyd_fc/fc_34-83/asadullah_qureshi.htm"),
    (40, "Asghar Ali", "hyd_fc/fc_34-83/asghar_ali.htm"),
    (41, "Poll Ramchandrarao Ashokanand", "hyd_fc/fc_34-83/pr_ashokanand.htm"),
    (42, "Ashwin Dhannulal Yadav", "hyd_fc/fc_04-08/ad_yadav.htm"),
    (43, "Asif Iqbal", "hyd_fc/fc_34-83/asif_iqbal.htm"),
    (44, "Mohammad Azharuddin", "hyd_fc/fc_34-83/m_azharuddin.htm"),
    (45, "Mir Azmath Ali", "hyd_fc/fc_34-83/m_azmath_ali.htm"),
    (46, "B Muthukrishna", "hyd_fc/fc_34-83/b_muthukrishna.htm"),
    (47, "Babubhai R Patel", "hyd_fc/fc_34-83/br_patel.htm"),
    (49, "Mazhar Ali Baig", "hyd_fc/fc_34-83/mazhar_a_baig.htm"),
    (50, "Mirza Faiz Baig", "hyd_fc/fc_34-83/m_faiz_baig.htm"),
    (51, "Murtuza Ali Baig", "hyd_fc/fc_34-83/murtuza_a_baig.htm"),
    (52, "Rehmat Baig", "hyd_fc/fc_34-83/r_baig.htm"),
    (53, "Balraz Santosh Kumar Yadav", "hyd_fc/fc_84-03/bsk_yadav.htm"),
    (54, "Bezwada Mahendra Kumar", "hyd_fc/fc_34-83/b_mahendra_kumar.htm"),
    (55, "Bhagya Rao", "hyd_fc/fc_34-83/bhagya_rao.htm"),
    (56, "Bharat Chand Khanna", "hyd_fc/fc_34-83/bc_khanna.htm"),
    (57, "Bhupait Mohan", "hyd_fc/fc_34-83/b_mohan.htm"),
    (59, "BN Krishnamurthy", "hyd_fc/fc_34-83/bn_krishnamurthy.htm"),
    (60, "Bobby Zahiruddin", "hyd_fc/fc_34-83/b_zahiruddin.htm"),
    (61, "MV Bobjee", "hyd_fc/fc_34-83/mv_bobjee.htm"),
    (62, "C Sridhar", "hyd_fc/fc_34-83/c_sridhar.htm"),
    (63, "Katikaneni Srinivas Chakravarthy", "hyd_fc/fc_84-03/ks_chakravarthy.htm"),
    (64, "CR Chandran", "hyd_fc/fc_34-83/cr_chandran.htm"),
    (66, "Chelluri Leo Jaikumar", "hyd_fc/fc_84-03/cl_jaikumar.htm"),
    (68, "D Maheshwar Singh", "hyd_fc/fc_34-83/d_maheshwar_singh.htm"),
    (69, "D Suresh", "hyd_fc/fc_84-03/d_suresh.htm"),
    (70, "Daitala Meherbaba", "hyd_fc/fc_34-83/d_meherbaba.htm"),
    (71, "Daniel Souri Manohar", "hyd_fc/fc_84-03/ds_manohar.htm"),
    (72, "Danny Dereck Prince", "hyd_fc/fc_04-08/dd_prince.htm"),
    (73, "Noel Arthur David", "hyd_fc/fc_84-03/na_david.htm"),
    (75, "Devishetty Vinay Kumar", "hyd_fc/fc_84-03/d_vinay_kumar.htm"),
    (76, "Devraj Devendraraj Govindraj", "hyd_fc/fc_34-83/dd_govindraj.htm"),
    (77, "Dhansukh", "hyd_fc/fc_34-83/dhansukh.htm"),
    (78, "Dharaka Bhanidipati Ravi Teja", "hyd_fc/fc_04-08/db_ravi_teja.htm"),
    (80, "Dhir Jagdish Lal", "hyd_fc/fc_34-83/d_jagdish_lal.htm"),
    (81, "Dilip Reddy", "hyd_fc/fc_34-83/d_reddy.htm"),
    (82, "Feredune Dhanjishaw Dittia", "hyd_fc/fc_34-83/fd_dittia.htm"),
    (83, "M Dittia", "hyd_fc/fc_34-83/m_dittia.htm"),
    (84, "Durga Prasad", "hyd_fc/fc_34-83/durga_prasad.htm"),
    (86, "Lyn Edwards", "hyd_fc/fc_34-83/l_edwards.htm"),
    (87, "Ehteshamuddin Ali Khan", "hyd_fc/fc_84-03/ehteshamuddin_ali_khan.htm"),
    (88, "F Mistry", "hyd_fc/fc_34-83/f_mistry.htm"),
    (89, "F Toorkey", "hyd_fc/fc_34-83/f_toorkey.htm"),
    (90, "Fahad Shahnawaz", "hyd_fc/fc_04-08/f_shahnawaz.htm"),
    (91, "Mohammad Faiz Ahmed", "hyd_fc/fc_84-03/m_faiz_ahmed.htm"),
    (94, "Fazluddin", "hyd_fc/fc_34-83/fazluddin.htm"),
    (96, "G Laxman", "hyd_fc/fc_34-83/g_laxman.htm"),
    (97, "G Srinivasan", "hyd_fc/fc_84-03/g_srinivasan.htm"),
    (98, "Gajanan Reddy", "hyd_fc/fc_84-03/g_reddy.htm"),
    (100, "Gevin Surma", "hyd_fc/fc_84-03/g_surma.htm"),
    (101, "Mohammad Ghouse Baba", "hyd_fc/fc_84-03/m_ghouse_baba.htm"),
    (102, "Ghulam Ahmed", "hyd_fc/fc_34-83/ghulam_ahmed.htm"),
    (103, "Ghulam Dastagir Qureshi", "hyd_fc/fc_34-83/gd_quershi.htm"),
    (104, "Roy Gilchrist", "hyd_fc/fc_34-83/r_gilchrist.htm"),
    (105, "Vishal Gopal Sharma", "hyd_fc/fc_04-08/vg_sharma.htm"),
    (107, "Gul Mohammad", "hyd_fc/fc_34-83/gul_mohd.htm"),
    (108, "Mohammad Habeeb Ahmed", "hyd_fc/fc_04-08/habeeb_ahmed.htm"),
    (109, "Habib Ahmed", "hyd_fc/fc_34-83/habib_ahmed.htm"),
    (110, "Mohammad Habib Khan", "hyd_fc/fc_34-83/habib_khan.htm"),
    (111, "Syed Mohammad Hadi", "hyd_fc/fc_34-83/sm_hadi.htm"),
    (112, "Hamid Warton Ali", "hyd_fc/fc_34-83/hamid_ali.htm"),
    (113, "Nagesh Hammond", "hyd_fc/fc_34-83/n_hammond.htm"),
    (114, "Hari Mohan", "hyd_fc/fc_84-03/hari_mohan.htm"),
    (115, "K Hariprasad", "hyd_fc/fc_34-83/k_hariprasad.htm"),
    (116, "S Himayatullah", "hyd_fc/fc_34-83/s_himayatullah.htm"),
    (117, "Hirji Kenia Jayantilal", "hyd_fc/fc_34-83/hk_jayantilal.htm"),
    (118, "Hisamuddin", "hyd_fc/fc_34-83/hisamuddin.htm"),
    (119, "Syed Mohammad Hussain", "hyd_fc/fc_34-83/sm_hussain.htm"),
    (120, "Hyder Ali", "hyd_fc/fc_34-83/hyder_ali.htm"),
    (121, "I Sanjiva Rao", "hyd_fc/fc_34-83/i_sanjiva_rao.htm"),
    (122, "Ibrahim Khaleel", "hyd_fc/fc_84-03/i_khaleel.htm"),
    (123, "Iftikharuddin", "hyd_fc/fc_34-83/iftikharuddin.htm"),
    (124, "Iqbal Rashid Siddiqui", "hyd_fc/fc_84-03/ir_siddiqui.htm"),
    (125, "Isa Khan", "hyd_fc/fc_34-83/isa_khan.htm"),
    (128, "M Jairam", "hyd_fc/fc_34-83/m_jairam.htm"),
    (129, "Motganhalli Laxminarsu Jaisimha", "hyd_fc/fc_34-83/ml_jaisimha.htm"),
    (130, "Vivek Jaisimha", "hyd_fc/fc_34-83/v_jaisimha.htm"),
    (132, "Jogram Shivaji Yadav", "hyd_fc/fc_84-03/js_yadav.htm"),
    (133, "Jyothi Shetty", "hyd_fc/fc_84-03/j_shetty.htm"),
    (134, "P Jyothiprasad", "hyd_fc/fc_34-83/p_jyothiprasad.htm"),
    (136, "K Naik", "hyd_fc/fc_34-83/k_naik.htm"),
    (137, "K Prabhakar Raju", "hyd_fc/fc_34-83/k_prabhakar_raju.htm"),
    (138, "K Ramakrishna", "hyd_fc/fc_34-83/k_ramakrishna.htm"),
    (139, "K Sainath", "hyd_fc/fc_34-83/k_sainath.htm"),
    (140, "K Shivaraj", "hyd_fc/fc_34-83/k_shivaraj.htm"),
    (141, "Kaleem-ul-Haq", "hyd_fc/fc_34-83/kaleem-ul-haq.htm"),
    (142, "Kanakasabhapathi", "hyd_fc/fc_34-83/kanakasabhapathi.htm"),
    (143, "Kanwaljit Singh", "hyd_fc/fc_34-83/kanwaljit_singh.htm"),
    (145, "Khaja Naeemuddin", "hyd_fc/fc_34-83/k_naeemuddin.htm"),
    (147, "Khalid Abdul Qayyum", "hyd_fc/fc_34-83/ka_qayyum.htm"),
    (148, "Khalil-ur-Rehman", "hyd_fc/fc_34-83/khalil-ur-rehman.htm"),
    (150, "Sangani Kiran Kumar", "hyd_fc/fc_84-03/s_kiran_kumar.htm"),
    (151, "Komadur Srinivasa Padmanabhan", "hyd_fc/fc_34-83/ks_padmanabhan.htm"),
    (153, "Krishnakant Ramabhai Patel", "hyd_fc/fc_34-83/kr_patel.htm"),
    (154, "S Krishnamurthi", "hyd_fc/fc_34-83/s_krishnamurthi.htm"),
    (156, "Pochiah Krishnamurthy", "hyd_fc/fc_34-83/p_krishnamurthy.htm"),
    (157, "L Vasan", "hyd_fc/fc_34-83/l_vasan.htm"),
    (158, "Lalit Mohan", "hyd_fc/fc_34-83/lalit_mohan.htm"),
    (161, "VVS Laxman", "hyd_fc/fc_84-03/vvs_laxman.htm"),
    (162, "Zahid Saeed Lodi", "hyd_fc/fc_34-83/zs_lodi.htm"),
    (163, "Sinderraj Lokenderraj", "hyd_fc/fc_34-83/s_lokenderraj.htm"),
    (167, "M Venkatesh Rao", "hyd_fc/fc_34-83/m_venkatesh_rao.htm"),
    (168, "VG Mache", "hyd_fc/fc_34-83/vg_mache.htm"),
    (171, "PR Man Singh", "hyd_fc/fc_34-83/pr_man_singh.htm"),
    (172, "Mangalapally Srinivas", "hyd_fc/fc_84-03/m_srinivas.htm"),
    (174, "V Manohar", "hyd_fc/fc_84-03/v_manohar.htm"),
    (175, "Mansur Ali Khan Pataudi", "hyd_fc/fc_34-83/mak_pataudi.htm"),
    (176, "Maturi Venkat Sridhar", "hyd_fc/fc_84-03/mv_sridhar.htm"),
    (177, "Marzban Mehta", "hyd_fc/fc_34-83/m_mehta.htm"),
    (178, "Maurice Robinson", "hyd_fc/fc_34-83/m_robinson.htm"),
    (180, "SM Mazhar", "hyd_fc/fc_34-83/sm_mazhar.htm"),
    (181, "Syed Meeraj", "hyd_fc/fc_84-03/s_meeraj.htm"),
    (182, "Mehboob Khan Nausheer", "hyd_fc/fc_34-83/mk_nausheer.htm"),
    (185, "Naushir S Mehta", "hyd_fc/fc_34-83/ns_mehta.htm"),
    (186, "Sorabji Rustomji Mehta", "hyd_fc/fc_34-83/sr_mehta.htm"),
    (189, "Miraj Ali", "hyd_fc/fc_34-83/miraj_ali.htm"),
    (192, "Modireddy Venkateshwar Narasimha Rao", "hyd_fc/fc_34-83/mv_narasimha_rao.htm"),
    (195, "Mohammad Ali Khan", "hyd_fc/fc_34-83/mohd_ali_khan.htm"),
    (201, "Mohammad Ibrahim Khan", "hyd_fc/fc_34-83/ibrahim_khan.htm"),
    (202, "Mohammad Mohiuddin", "hyd_fc/fc_84-03/m_mohiuddin.htm"),
    (203, "Mohammad Yusuf", "hyd_fc/fc_34-83/mohd_yusuf.htm"),
    (204, "Mohammed Shakeer", "hyd_fc/fc_04-08/m_shakeer.htm"),
    (205, "Vijay Mohanraj", "hyd_fc/fc_34-83/v_mohanraj.htm"),
    (207, "Motganhalli Laxminarsu Jaisimha", "hyd_fc/fc_34-83/ml_jaisimha.htm"),
    (208, "MS Sriram", "hyd_fc/fc_34-83/ms_sriram.htm"),
    (209, "Mumtaz Hussain", "hyd_fc/fc_34-83/mumtaz_hussain.htm"),
    (211, "Muralidharan", "hyd_fc/fc_34-83/muralidharan.htm"),
    (213, "Mushtaq Ahmed", "hyd_fc/fc_34-83/mushtaq_ahmed.htm"),
    (216, "MV Ramanamurthy", "hyd_fc/fc_84-03/mv_ramanamurthy.htm"),
    (217, "N Premkumar", "hyd_fc/fc_34-83/n_premkumar.htm"),
    (221, "Nandlal Rajesh Yadav", "hyd_fc/fc_84-03/nr_yadav.htm"),
    (222, "Nandlal Shivlal Yadav", "hyd_fc/fc_34-83/ns_yadav.htm"),
    (224, "Narasimhachariya Upadhyay Prahalad", "hyd_fc/fc_34-83/n_prahalad.htm"),
    (225, "Narender Pal Singh", "hyd_fc/fc_84-03/np_singh.htm"),
    (226, "S Nasir Ali Khan", "hyd_fc/fc_34-83/s_nasir_a_khan.htm"),
    (227, "Nasiruddin", "hyd_fc/fc_34-83/nasiruddin.htm"),
    (229, "Naushir S Mehta", "hyd_fc/fc_34-83/ns_mehta.htm"),
    (230, "V Navinatham", "hyd_fc/fc_34-83/v_navinatham.htm"),
    (231, "Nayini Santosh Kumar Reddy", "hyd_fc/fc_34-83/nsk_reddy.htm"),
    (232, "Pagadala Saikumar Niranjan", "hyd_fc/fc_04-08/ps_niranjan.htm"),
    (233, "R Moses Nityanand", "hyd_fc/fc_34-83/r_moses_nityanand.htm"),
    (234, "Nizam Yar Khan", "hyd_fc/fc_34-83/nizam_y_khan.htm"),
    (236, "Pragyan Prayish Ojha", "hyd_fc/fc_04-08/pp_ojha.htm"),
    (238, "P Tata Rao", "hyd_fc/fc_34-83/p_tata_rao.htm"),
    (239, "P Venkat Murthy", "hyd_fc/fc_84-03/p_venkata_murthy.htm"),
    (240, "Padala Shashank Nag", "hyd_fc/fc_04-08/p_shashank_nag.htm"),
    (241, "Paddi Kaushik Reddy", "hyd_fc/fc_04-08/pk_reddy.htm"),
    (242, "Padma Rao", "hyd_fc/fc_34-83/padma_rao.htm"),
    (245, "Srinivas Anoop Pai", "hyd_fc/fc_04-08/sa_pai.htm"),
    (246, "Parth Ramkrishna Satwalkar", "hyd_fc/fc_84-03/pr_satwalkar.htm"),
    (250, "Pawan Kumar", "hyd_fc/fc_84-03/pawan_kumar.htm"),
    (251, "Tangirala Pawan Kumar", "hyd_fc/fc_84-03/t_pawan_kumar.htm"),
    (252, "Vallarapu Pawan Kumar", "hyd_fc/fc_84-03/v_pawan_kumar.htm"),
    (253, "Peddi Inder Shekar Reddy", "hyd_fc/fc_84-03/pis_reddy.htm"),
    (254, "Peddi Papi Reddy", "hyd_fc/fc_84-03/pp_reddy.htm"),
    (255, "Sunil Phillips", "hyd_fc/fc_84-03/s_phillip.htm"),
    (259, "Pondicharry Masilamani Rangaraj", "hyd_fc/fc_84-03/pm_rangaraj.htm"),
    (260, "Pottimuthyala Ramesh Kumar", "hyd_fc/fc_84-03/p_ramesh_kumar.htm"),
    (265, "Vanka Pratap", "hyd_fc/fc_84-03/v_pratap.htm"),
    (270, "Qutubuddin", "hyd_fc/fc_34-83/qutubuddin.htm"),
    (271, "R Moses Nityanand", "hyd_fc/fc_34-83/r_moses_nityanand.htm"),
    (273, "S Rahim", "hyd_fc/fc_34-83/s_rahim.htm"),
    (274, "Rajkumar Singh", "hyd_fc/fc_34-83/rajkumar_singh.htm"),
    (277, "Ramakrishnan Sridhar", "hyd_fc/fc_84-03/r_sridhar.htm"),
    (282, "Rashid Ashraf", "hyd_fc/fc_84-03/r_ashraf.htm"),
    (283, "Timothy Ravi Kumar", "hyd_fc/fc_84-03/t_ravi_kumar.htm"),
    (285, "Rayapeth Arjun Swaroop", "hyd_fc/fc_84-03/ra_swaroop.htm"),
    (293, "RH Sabir", "hyd_fc/fc_34-83/rh_sabir.htm"),
    (294, "Shaikh Riazuddin", "hyd_fc/fc_84-03/s_riazuddin.htm"),
    (295, "Riazul Haq", "hyd_fc/fc_34-83/riazul_haq.htm"),
    (296, "RK Rao", "hyd_fc/fc_34-83/rk_rao.htm"),
    (298, "Rohit Kumar Sabharwal", "hyd_fc/fc_84-03/rk_sabharwal.htm"),
    (300, "RV Seshadri", "hyd_fc/fc_34-83/rv_seshadri.htm"),
    (306, "Saad Bin Jung", "hyd_fc/fc_34-83/saad_b_jung.htm"),
    (308, "Sabir Hussain", "hyd_fc/fc_34-83/sabir_hussain.htm"),
    (309, "Sagi Lakshmi Venkatapathy Raju", "hyd_fc/fc_84-03/slv_raju.htm"),
    (311, "Salamat Ali Khan", "hyd_fc/fc_84-03/salamat_ali_khan.htm"),
    (314, "Sankinani Vishnuvardhan", "hyd_fc/fc_84-03/s_vishnuvardhan.htm"),
    (315, "Sardar Khan", "hyd_fc/fc_34-83/sardar_khan.htm"),
    (318, "Shahid S Akbar", "hyd_fc/fc_34-83/ss_akber.htm"),
    (320, "Shaik Abu Baqar Bin Ahmed", "hyd_fc/fc_84-03/sabb_ahmed.htm"),
    (327, "Syed Mohammad Shoaib", "hyd_fc/fc_04-08/sm_shoaib.htm"),
    (330, "Sinderraj Lokenderraj", "hyd_fc/fc_34-83/s_lokenderraj.htm"),
    (331, "SM Mazhar", "hyd_fc/fc_34-83/sm_mazhar.htm"),
    (340, "Sultan Saleem", "hyd_fc/fc_34-83/s_saleem.htm"),
    (341, "Tirumalasetti Laxminarayana Suman", "hyd_fc/fc_84-03/tl_suman.htm"),
    (344, "Gevin Surma", "hyd_fc/fc_84-03/g_surma.htm"),
    (351, "T Vijay Paul", "hyd_fc/fc_34-83/tv_paul.htm"),
    (357, "Tummalapahi Vijay Kumar", "hyd_fc/fc_84-03/t_vijay_kumar.htm"),
    (358, "Ushaq Ahmed", "hyd_fc/fc_34-83/ushaq_ahmed.htm"),
    (361, "Vajubha", "hyd_fc/fc_34-83/vajubha.htm"),
    (369, "Venkataswami", "hyd_fc/fc_34-83/venkatswami.htm"),
    (373, "Vijay Mohanraj", "hyd_fc/fc_34-83/v_mohanraj.htm"),
    (378, "Vivek Jaisimha", "hyd_fc/fc_34-83/v_jaisimha.htm"),
    (379, "Waheed Yar Khan", "hyd_fc/fc_34-83/waheed_yar_khan.htm"),
    (380, "Wahiduddin", "hyd_fc/fc_34-83/wahiduddin.htm"),
    (387, "Youraj Singh", "hyd_fc/fc_84-03/youraj_singh.htm"),
    (388, "Zahid Ali Khan", "hyd_fc/fc_34-83/zahid_ali_khan.htm"),
    (390, "Zakir Hussain", "hyd_fc/fc_84-03/zakir_hussain.htm"),
]

# Deduplicate by URL, keeping first occurrence
seen_urls = {}
PLAYERS = []
for serial, name, url in RAW_PLAYERS:
    if url not in seen_urls:
        seen_urls[url] = True
        PLAYERS.append((serial, name, url))

# Batting table column headers we might encounter
BATTING_COLS = ["m", "i", "no", "runs", "hs", "ave", "100", "50", "ct", "st", "sr", "4s", "6s"]
BOWLING_COLS = ["balls", "mdns", "runs", "wkts", "bb", "ave", "5wi", "10wm", "srate", "econ"]

# Format keywords that appear in table captions / surrounding text
FORMAT_KEYWORDS = {
    "test": "Test",
    "first-class": "First-Class",
    "first class": "First-Class",
    "one-day international": "ODI",
    "one day international": "ODI",
    "odi": "ODI",
    "list a": "List-A",
    "overall one-day": "List-A",
    "twenty20": "T20",
    "t20": "T20",
}


def to_float(val):
    val = val.strip().replace(",", "")
    if val in ("-", "", "—", "–", "N/A", "n/a"):
        return None
    try:
        return float(val)
    except ValueError:
        return None


def to_int(val):
    val = val.strip().replace(",", "")
    if val in ("-", "", "—", "–", "N/A", "n/a"):
        return None
    try:
        return int(float(val))
    except ValueError:
        return None


def detect_format(text):
    """Return a format label based on surrounding text."""
    text_lower = text.lower()
    for keyword, label in FORMAT_KEYWORDS.items():
        if keyword in text_lower:
            return label
    return "First-Class"


def extract_period(text):
    """Extract season range like 1984/85-1999/00 from text."""
    m = re.search(r"(\d{4}[/\-]\d{2,4}\s*[-–]\s*\d{4}[/\-]\d{2,4}|\d{4}[/\-]\d{2,4}|\d{4})", text)
    return m.group(0).strip() if m else None


def parse_batting_row(headers, cells):
    """Map a data row to batting stat dict."""
    row = {}
    for h, c in zip(headers, cells):
        row[h] = c.get_text(strip=True)

    def g(keys, default=None):
        for k in keys:
            if k in row:
                return row[k]
        return default

    return {
        "matches": to_int(g(["m", "mat"])),
        "innings": to_int(g(["i", "inns", "inn"])),
        "not_out": to_int(g(["no"])),
        "runs": to_int(g(["runs"])),
        "highest_score": g(["hs"]),
        "average": to_float(g(["ave", "avg"])),
        "centuries": to_int(g(["100"])),
        "half_centuries": to_int(g(["50"])),
        "catches": to_int(g(["ct"])),
        "stumpings": to_int(g(["st"])),
        "strike_rate": to_float(g(["sr", "srate"])),
    }


def parse_bowling_row(headers, cells):
    """Map a data row to bowling stat dict."""
    row = {}
    for h, c in zip(headers, cells):
        row[h] = c.get_text(strip=True)

    def g(keys, default=None):
        for k in keys:
            if k in row:
                return row[k]
        return default

    return {
        "balls": to_int(g(["balls", "ball"])),
        "maidens": to_int(g(["mdns", "mdn"])),
        "runs": to_int(g(["runs"])),
        "wickets": to_int(g(["wkts", "wkt", "wk"])),
        "best_bowling": g(["bb"]),
        "average": to_float(g(["ave", "avg"])),
        "five_wicket_innings": to_int(g(["5wi"])),
        "ten_wicket_match": to_int(g(["10wm"])),
        "strike_rate": to_float(g(["srate", "sr"])),
        "economy": to_float(g(["econ"])),
    }


def is_batting_table(headers):
    hset = set(h.lower() for h in headers)
    return bool({"m", "i", "runs", "hs"} & hset or {"mat", "inns", "runs", "hs"} & hset)


def is_bowling_table(headers):
    hset = set(h.lower() for h in headers)
    return bool({"balls", "wkts", "bb"} & hset or {"balls", "wkt", "bb"} & hset)


def get_context_text(table, soup):
    """Get text from elements immediately before the table for format detection."""
    parts = []
    for sib in table.previous_siblings:
        text = sib.get_text(strip=True) if hasattr(sib, "get_text") else str(sib).strip()
        if text:
            parts.insert(0, text)
        if len(parts) >= 4:
            break
    return " ".join(parts)


def extract_personal_info(soup):
    info = {"full_name": None, "birth_date": None, "birth_place": None,
            "batting_style": None, "bowling_style": None}
    text = soup.get_text(" ", strip=True)

    # Full name
    m = re.search(r"Full\s+[Nn]ame[:\s]+([^\n\r]+?)(?:Born|Birth|Batting|$)", text)
    if m:
        info["full_name"] = m.group(1).strip()

    # Birth date
    m = re.search(r"Born[:\s]+([^,\n]+(?:\d{4}))", text)
    if m:
        info["birth_date"] = m.group(1).strip()

    # Birth place — text after comma following date
    m = re.search(r"Born[:\s]+[^,]+,\s*([^\n\r]+?)(?:Batting|Bowling|Playing|$)", text)
    if m:
        info["birth_place"] = m.group(1).strip()

    # Batting style
    m = re.search(r"Batting[:\s]+([^\n\r;,\.]+)", text, re.IGNORECASE)
    if m:
        info["batting_style"] = m.group(1).strip()

    # Bowling style
    m = re.search(r"Bowling[:\s]+([^\n\r;,\.]+)", text, re.IGNORECASE)
    if m:
        info["bowling_style"] = m.group(1).strip()

    return info


def scrape_player(url):
    """Fetch a player page and return (personal_info, batting_stats[], bowling_stats[])."""
    full_url = BASE_URL + url
    try:
        resp = requests.get(full_url, timeout=15)
        resp.raise_for_status()
        # Try to detect encoding
        resp.encoding = resp.apparent_encoding or "utf-8"
    except Exception as e:
        print(f"  ERROR fetching {full_url}: {e}")
        return None, [], []

    soup = BeautifulSoup(resp.text, "html.parser")
    personal = extract_personal_info(soup)
    batting_records = []
    bowling_records = []

    for table in soup.find_all("table"):
        rows = table.find_all("tr")
        if not rows:
            continue

        # Find header row
        header_row = None
        header_cells = []
        for row in rows:
            ths = row.find_all("th")
            tds = row.find_all("td")
            if ths:
                header_cells = ths
                header_row = row
                break
            # Sometimes headers are bold TDs
            bolds = [td for td in tds if td.find("b") or td.find("strong")]
            if len(bolds) >= 4:
                header_cells = tds
                header_row = row
                break

        if not header_cells:
            continue

        headers = [c.get_text(strip=True).lower() for c in header_cells]

        if not (is_batting_table(headers) or is_bowling_table(headers)):
            continue

        context = get_context_text(table, soup)
        # Also check caption
        caption = table.find("caption")
        if caption:
            context = caption.get_text(strip=True) + " " + context

        fmt = detect_format(context)
        period = extract_period(context)

        data_rows = [r for r in rows if r != header_row]
        for row in data_rows:
            cells = row.find_all(["td", "th"])
            if not cells or len(cells) < 3:
                continue
            cell_texts = [c.get_text(strip=True) for c in cells]
            # Skip rows that look like sub-headers or empty
            if all(t == "" or t == "-" or t == "—" for t in cell_texts):
                continue
            # Skip if looks like a repeated header
            first = cell_texts[0].lower()
            if first in ("m", "mat", "balls", "inns"):
                continue

            if is_batting_table(headers):
                stat = parse_batting_row(headers, cells)
                stat["format"] = fmt
                stat["period"] = period
                batting_records.append(stat)
            elif is_bowling_table(headers):
                stat = parse_bowling_row(headers, cells)
                stat["format"] = fmt
                stat["period"] = period
                bowling_records.append(stat)

    return personal, batting_records, bowling_records


def setup_db(conn):
    conn.executescript("""
    CREATE TABLE IF NOT EXISTS players (
        id          INTEGER PRIMARY KEY,
        serial_no   INTEGER,
        name        TEXT NOT NULL,
        page_url    TEXT UNIQUE,
        full_name   TEXT,
        birth_date  TEXT,
        birth_place TEXT,
        batting_style TEXT,
        bowling_style TEXT,
        era         TEXT
    );

    CREATE TABLE IF NOT EXISTS batting_stats (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        player_id       INTEGER NOT NULL,
        format          TEXT,
        period          TEXT,
        matches         INTEGER,
        innings         INTEGER,
        not_out         INTEGER,
        runs            INTEGER,
        highest_score   TEXT,
        average         REAL,
        centuries       INTEGER,
        half_centuries  INTEGER,
        catches         INTEGER,
        stumpings       INTEGER,
        strike_rate     REAL,
        FOREIGN KEY (player_id) REFERENCES players(id)
    );

    CREATE TABLE IF NOT EXISTS bowling_stats (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        player_id           INTEGER NOT NULL,
        format              TEXT,
        period              TEXT,
        balls               INTEGER,
        maidens             INTEGER,
        runs                INTEGER,
        wickets             INTEGER,
        best_bowling        TEXT,
        average             REAL,
        five_wicket_innings INTEGER,
        ten_wicket_match    INTEGER,
        strike_rate         REAL,
        economy             REAL,
        FOREIGN KEY (player_id) REFERENCES players(id)
    );
    """)
    conn.commit()


def era_from_url(url):
    if "fc_34-83" in url:
        return "1934-1983"
    if "fc_84-03" in url:
        return "1984-2003"
    if "fc_04-08" in url:
        return "2004-2008"
    return None


def main():
    conn = sqlite3.connect(DB_PATH)
    setup_db(conn)

    total = len(PLAYERS)
    ok = 0
    skipped = 0

    for idx, (serial, name, url) in enumerate(PLAYERS, 1):
        print(f"[{idx}/{total}] {name} ...", end=" ", flush=True)

        # Check if already scraped
        row = conn.execute("SELECT id FROM players WHERE page_url = ?", (url,)).fetchone()
        if row:
            print("already in DB, skipping")
            skipped += 1
            continue

        personal, batting, bowling = scrape_player(url)

        # Insert player
        conn.execute(
            """INSERT OR IGNORE INTO players
               (serial_no, name, page_url, full_name, birth_date, birth_place,
                batting_style, bowling_style, era)
               VALUES (?,?,?,?,?,?,?,?,?)""",
            (serial, name, url,
             personal.get("full_name") if personal else None,
             personal.get("birth_date") if personal else None,
             personal.get("birth_place") if personal else None,
             personal.get("batting_style") if personal else None,
             personal.get("bowling_style") if personal else None,
             era_from_url(url)),
        )
        player_id = conn.execute("SELECT id FROM players WHERE page_url = ?", (url,)).fetchone()[0]

        for stat in batting:
            conn.execute(
                """INSERT INTO batting_stats
                   (player_id, format, period, matches, innings, not_out, runs,
                    highest_score, average, centuries, half_centuries, catches,
                    stumpings, strike_rate)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (player_id, stat["format"], stat["period"], stat["matches"],
                 stat["innings"], stat["not_out"], stat["runs"], stat["highest_score"],
                 stat["average"], stat["centuries"], stat["half_centuries"],
                 stat["catches"], stat["stumpings"], stat["strike_rate"]),
            )

        for stat in bowling:
            conn.execute(
                """INSERT INTO bowling_stats
                   (player_id, format, period, balls, maidens, runs, wickets,
                    best_bowling, average, five_wicket_innings, ten_wicket_match,
                    strike_rate, economy)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (player_id, stat["format"], stat["period"], stat["balls"],
                 stat["maidens"], stat["runs"], stat["wickets"], stat["best_bowling"],
                 stat["average"], stat["five_wicket_innings"], stat["ten_wicket_match"],
                 stat["strike_rate"], stat["economy"]),
            )

        conn.commit()
        print(f"bat={len(batting)} bowl={len(bowling)}")
        ok += 1
        time.sleep(DELAY)

    conn.close()
    print(f"\nDone. Players scraped: {ok}, skipped (already in DB): {skipped}")
    print(f"DB: {DB_PATH}")


if __name__ == "__main__":
    main()