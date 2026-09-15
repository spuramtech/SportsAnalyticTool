# HCA Expert Cricket Analytics Report

## Scope and Evidence Contract
- Generated: 2026-09-12T07:43:01.926Z
- Coverage: HCA tournament, team, player, batting, and bowling feeds for 2024-2026.
- Latest observed season: 2026
- This report is descriptive and decision-support oriented. It does not infer injuries, opposition strength, pitch conditions, selection certainty, or causality because those fields are not present in the source data.
- Player and team recommendations require the confidence and sample-size rules below; small samples are explicitly excluded from the main rankings.

## Operating Model
1. **Source control:** preserve raw feed payloads, endpoint, fetch status, and extraction timestamp in `source_feeds`.
2. **Role separation:** evaluate batting and bowling independently; a player can appear in both tracks.
3. **Opportunity adjustment:** report runs per balls faced and wickets per legal ball alongside totals; never use totals alone to select a player.
4. **Cohort discipline:** compare players within the tournament and season context before making cross-season decisions.
5. **Evidence tiers:** High confidence requires at least 3 matches, 3 innings, and 100 runs for batting, or 3 bowling matches, 60 legal balls, and 3 wickets for bowling.
6. **Human review gate:** recommendations are hypotheses for an analyst or coach to review against video, role, fitness, opposition, and workload data that this source does not provide.

## Data Quality Validation
| Check | Observed | Interpretation |
| --- | --- | --- |
| duplicate_player_keys | 0 | must be 0 |
| negative_runs | 0 | must be 0 |
| negative_wickets | 0 | must be 0 |
| missing_player_ids | 0 | investigate before selection |
| failed_source_feeds | 117 | exclude or disclose |
| player_stats_rows | 19746 | coverage denominator |

## Batting Leaders With Evidence Threshold
| Player | Team | Season | Runs | Balls | Calculated SR | Matches | Tournaments | Confidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| M SAI PRAGNAY REDDY | East Marredpally | 2025 | 1220 | 1059 | 115.2 | 19 | 3 | High |
| MIRZA HOUZEF BAIG | Nizam Cricket Club | 2025 | 1158 | 724 | 159.94 | 13 | 1 | High |
| SAI VIKAS REDDY | Evergreen | 2025 | 1144 | 1168 | 97.95 | 18 | 3 | High |
| MD FAIZ AHMED | Gunrock | 2024 | 1058 | 714 | 148.18 | 8 | 1 | High |
| K NITESH REDDY | Gemini Friends | 2025 | 1004 | 1051 | 95.53 | 16 | 3 | High |
| HRISHIKESH SIMHA | Balaaji | 2025 | 982 | 1030 | 95.34 | 18 | 3 | High |
| SK REHAAN ROSHAN | Imperial | 2025 | 971 | 1269 | 76.52 | 16 | 2 | High |
| RISHIKET SISODIA | Deccan Wanderers | 2025 | 967 | 597 | 161.98 | 20 | 3 | High |
| G SUBRAMANYAM SWAMY | Cosmos | 2025 | 953 | 701 | 135.95 | 10 | 1 | High |
| JAI RAM KASYAP | Budding Star | 2025 | 920 | 985 | 93.4 | 16 | 3 | High |
| C SIDDHARTH RAO | Sportive | 2025 | 905 | 832 | 108.77 | 17 | 2 | High |
| GNANA PRAKASH REDDY | Nalgonda District | 2025 | 895 | 740 | 120.95 | 18 | 2 | High |
| V NITHIN NAYAK | Gouds XI | 2025 | 892 | 813 | 109.72 | 14 | 2 | High |
| K JAIDEV GOUD | Sagar XI | 2025 | 891 | 662 | 134.59 | 11 | 1 | High |
| ABHIRATH M | Jai Hanuman | 2024 | 879 | 816 | 107.72 | 8 | 2 | High |
| S LOKNATH | Imperial | 2025 | 876 | 654 | 133.94 | 18 | 2 | High |
| DARSH MOHAN LAL | Galaxy | 2025 | 875 | 1025 | 85.37 | 12 | 2 | High |
| SHREY SINGH | Raju Cricket Club | 2025 | 874 | 1264 | 69.15 | 12 | 2 | High |
| VINEETH PAWAR | Red Hills | 2024 | 868 | 592 | 146.62 | 12 | 2 | High |
| YASH GUPTA | Budding Star | 2025 | 865 | 919 | 94.12 | 16 | 3 | High |
| SYED ALI | Lal Bahadur PG | 2025 | 848 | 677 | 125.26 | 9 | 1 | High |
| ARHAAN SATWALEKAR | P Krishna Murty | 2025 | 838 | 1095 | 76.53 | 10 | 1 | High |
| ABDUL RAFEAY BIN ABDULLAH | Mahbubnagar District | 2025 | 835 | 1215 | 68.72 | 15 | 2 | High |
| SHASHANK LOKESH | Cambridge XI | 2025 | 834 | 827 | 100.85 | 18 | 3 | High |
| ADE SANTOSH | Adilabad District | 2025 | 829 | 664 | 124.85 | 14 | 2 | High |

## Bowling Leaders With Evidence Threshold
| Player | Team | Season | Wickets | Legal balls | Calculated Econ | Calculated Avg | Matches | Confidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RISHAB BASLAS | East Marredpally | 2025 | 50 | 1302 | 3.8 | 16.48 | 21 | High |
| ASHISH SRIVASTAV | Deccan Wanderers | 2025 | 49 | 1058 | 4.3 | 15.49 | 20 | High |
| MD MUQEETH UDDIN | Mahbubnagar District | 2025 | 46 | 699 | 2.84 | 7.2 | 15 | High |
| Ashish   srivastav | Deccan Wanderers | 2026 | 42 | 792 | 4.55 | 14.31 | 14 | High |
| SOMASANI RAJU | Marredpally Blues | 2025 | 40 | 807 | 3.79 | 12.75 | 15 | High |
| MD ABRAR | Young Masters | 2024 | 40 | 857 | 4.15 | 14.82 | 14 | High |
| B BHARATH REDDY | Combined District | 2025 | 37 | 867 | 5.52 | 21.54 | 17 | High |
| A BHARATH KUMAR | Imperial | 2025 | 36 | 882 | 3.16 | 12.92 | 18 | High |
| SHAIK ABDUL SABUR | Nizam Cricket Club | 2025 | 36 | 653 | 4.32 | 13.06 | 13 | High |
| DAKSH G | Youth | 2024 | 35 | 616 | 3.26 | 9.57 | 12 | High |
| S AKHIL KUMAR | Nalgonda District | 2025 | 35 | 777 | 3.79 | 14.03 | 17 | High |
| G ARJUN | Evergreen | 2025 | 35 | 946 | 4.87 | 21.94 | 17 | High |
| G VIKRAM NAIK | Nizamabad District | 2025 | 34 | 836 | 2.57 | 10.53 | 16 | High |
| DIVESH SINGH | Deccan Chronicle | 2025 | 34 | 773 | 4.37 | 16.56 | 18 | High |
| SACHEIT BINJRAJKA | East Marredpally | 2025 | 34 | 983 | 4.39 | 21.18 | 17 | High |
| G ANIKETH REDDY | Evergreen | 2024 | 33 | 611 | 2.52 | 7.79 | 7 | High |
| MD SAQLAIN ARAFAT | Evergreen | 2025 | 33 | 1127 | 4.35 | 24.79 | 18 | High |
| SHASHANK MEHROTRA | Deccan Wanderers | 2025 | 33 | 919 | 4.43 | 20.55 | 18 | High |
| S VAMSHHI KUMAAR | Manikumar | 2024 | 32 | 612 | 3.02 | 9.63 | 12 | High |
| H ADITHYA | Mahadev | 2024 | 32 | 678 | 3.38 | 11.94 | 14 | High |
| D S KEERTHAN PRAISE | Nalgonda District | 2025 | 32 | 683 | 4.56 | 16.22 | 17 | High |
| K SATHISH CHANDRA | Team Speed | 2025 | 32 | 668 | 4.75 | 16.53 | 13 | High |
| RAJAMANI PRASAD | Marredpally Colts | 2024 | 32 | 743 | 5.02 | 19.44 | 15 | High |
| VARUN AVS | Sri Shyam | 2024 | 31 | 755 | 3.69 | 14.97 | 15 | High |
| VIVEK SINGH | Khalsa | 2025 | 31 | 767 | 3.74 | 15.42 | 13 | High |

## Team Performance By Season
| Team | Season | Matches | Wins | Losses | Win rate % | Points | Run ratio |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Red Hills | 2026 | 6 | 6 | 0 | 100 | 12 | 1.535 |
| SA Amberpet | 2026 | 6 | 6 | 0 | 100 | 12 | 1.329 |
| Sagar XI | 2026 | 6 | 6 | 0 | 100 | 12 | 1.442 |
| Southern Stars | 2026 | 6 | 6 | 0 | 100 | 12 | 1.559 |
| Safilguda | 2026 | 6 | 6 | 0 | 100 | 12 | 1.34 |
| Sunshine | 2026 | 6 | 6 | 0 | 100 | 12 | 2.506 |
| Walkertown | 2026 | 6 | 6 | 0 | 100 | 12 | 1.852 |
| Swastik Union | 2026 | 6 | 6 | 0 | 100 | 12 | 1.385 |
| Reliance | 2026 | 6 | 6 | 0 | 100 | 10 | 1.541 |
| Saint Sai | 2026 | 5 | 5 | 0 | 100 | 10 | 1.376 |
| Senior Mens - D | 2026 | 2 | 2 | 0 | 100 | 8 | 1.119 |
| U19 Womens - N | 2026 | 3 | 3 | 0 | 100 | 8 | 1.648 |
| Kishore & Sons | 2026 | 3 | 3 | 0 | 100 | 6 | 1.023 |
| U19 Womens - C | 2026 | 3 | 3 | 0 | 100 | 6 | 1.014 |
| U19 Womens - E | 2026 | 3 | 3 | 0 | 100 | 6 | 1.653 |
| MU23 Emerging - A | 2026 | 1 | 1 | 0 | 100 | 6 | 1.003 |
| U19 Womens - W | 2026 | 3 | 3 | 0 | 100 | 6 | 1.172 |
| Pallavi Model School - Alwal | 2026 | 2 | 2 | 0 | 100 | 4 | 1.538 |
| Crescent High School - Hafez Baba Nagar | 2026 | 2 | 2 | 0 | 100 | 4 | 2.556 |
| Gowtham Model School - Chandanagar | 2026 | 2 | 2 | 0 | 100 | 4 | 2.052 |
| Mahesh | 2026 | 2 | 2 | 0 | 100 | 4 | 1.607 |
| Greenlands | 2026 | 2 | 2 | 0 | 100 | 4 | 2.425 |
| Secunderabad Club | 2026 | 2 | 2 | 0 | 100 | 4 | 2.403 |
| MU19 Super League - B | 2026 | 2 | 2 | 0 | 100 | 4 | 1.019 |
| MU19 Super League - F | 2026 | 2 | 2 | 0 | 100 | 4 | 1.075 |
| Medjee Junior College - Sec.bad | 2026 | 2 | 2 | 0 | 100 | 4 | 1.457 |
| U19 Womens - R | 2026 | 3 | 3 | 0 | 100 | 4 | 1.274 |
| Gowtham Model School - West Marredpally | 2026 | 2 | 2 | 0 | 100 | 2 | 1.638 |
| St Patricks High School - Secunderabad | 2026 | 1 | 1 | 0 | 100 | 2 | 1.024 |
| Silver Oaks Interantional School - Bachupally | 2026 | 1 | 1 | 0 | 100 | 2 | 2.032 |
| The Hyderabad Public School - Begumpet | 2026 | 2 | 2 | 0 | 100 | 2 | 2.043 |
| Bhavans Sri Aurobindo Junior College - Sainikpuri | 2026 | 2 | 2 | 0 | 100 | 2 | 3.503 |
| Hidayah Islamic International School - Mehdipatnam | 2026 | 2 | 2 | 0 | 100 | 2 | 3.137 |
| Shree Swaminarayan Gurukul International School - Moinabad | 2026 | 1 | 1 | 0 | 100 | 2 | 1.292 |
| Oakridge International School - Gachibowli | 2026 | 2 | 2 | 0 | 100 | 2 | 1.595 |
| The Gaudium School - Kollur | 2026 | 2 | 2 | 0 | 100 | 2 | 1.804 |
| Panduranga Pai Memorial | 2026 | 1 | 1 | 0 | 100 | 2 | 1.005 |
| Medak District - 1 | 2026 | 1 | 1 | 0 | 100 | 2 | 26.826 |
| Warangal District - 1 | 2026 | 1 | 1 | 0 | 100 | 2 | 1.105 |
| Nalgonda District - 1 | 2026 | 1 | 1 | 0 | 100 | 2 | 1.016 |
| JRS International School - Narapally | 2026 | 2 | 2 | 0 | 100 | 2 | 3.182 |
| Indus Universal School - Sainkpuri | 2026 | 2 | 2 | 0 | 100 | 2 | 2.156 |
| St Andrews School - Keesara | 2026 | 2 | 2 | 0 | 100 | 2 | 1.019 |
| Pallavi Model School - Bowenpally | 2026 | 1 | 1 | 0 | 100 | 2 | 1.179 |
| Genesis School - Kukatpally | 2026 | 1 | 1 | 0 | 100 | 2 | 1.006 |
| IGNITE Junior College - Medchal | 2026 | 1 | 1 | 0 | 100 | 2 | 1.036 |
| Walkertown School - Padmaro Nagar | 2026 | 1 | 1 | 0 | 100 | 2 | 1.011 |
| Hyderabad - MU19 | 2026 | 1 | 1 | 0 | 100 | 2 | 1.015 |
| Cal Public School - Kapra | 2026 | 2 | 2 | 0 | 100 | 0 | 1.012 |
| Gowtham Model School - Ameerpet | 2026 | 2 | 2 | 0 | 100 | 0 | 1.036 |

## Multi-Season Player Trend Signals
| Player | First season | Latest season | Prior runs | Latest runs | Prior wickets | Latest wickets | Seasons observed |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ABHIRATH REDDY MANDADI | 2024 | 2026 | 1782 | 1491 | 8 | 7 | 3 |
| Sai Vikas Reddy | 2024 | 2026 | 1866 | 1362 | 0 | 0 | 3 |
| Tanmay Agarwal | 2024 | 2026 | 701 | 1180 | 5 | 0 | 3 |
| Patkuri Nitish Reddy | 2024 | 2026 | 1342 | 1115 | 1 | 3 | 3 |
| P Advith Reddy | 2024 | 2026 | 1271 | 1114 | 4 | 2 | 3 |
| Bhavesh Seth | 2025 | 2026 | 559 | 1108 | 0 | 1 | 2 |
| Shaik Rehaan Roshan | 2024 | 2026 | 1525 | 1009 | 0 | 0 | 3 |
| Wafi  Kachchhi | 2024 | 2026 | 907 | 985 | 27 | 23 | 3 |
| Jashwanth Mote | 2024 | 2026 | 1081 | 981 | 0 | 2 | 3 |
| Kushal Sheerla | 2024 | 2026 | 334 | 974 | 0 | 0 | 3 |
| ADITYA JAVVAJI | 2024 | 2026 | 1257 | 967 | 0 | 0 | 3 |
| Aravelly Avanish Rao | 2024 | 2026 | 949 | 952 | 1 | 0 | 3 |
| ANANTH PRATEEK REDDY | 2024 | 2026 | 943 | 938 | 0 | 1 | 3 |
| Rahul Radesh | 2024 | 2026 | 698 | 922 | 0 | 0 | 3 |
| T Shiva Rama Krishna | 2024 | 2026 | 1323 | 919 | 9 | 6 | 3 |
| Mickil Jaiswal | 2024 | 2026 | 1617 | 877 | 46 | 23 | 3 |
| Hrishikesh Simha | 2024 | 2026 | 1927 | 874 | 19 | 3 | 3 |
| Khush Agarwal | 2025 | 2026 | 166 | 855 | 26 | 23 | 2 |
| Aaron George Varghese | 2024 | 2026 | 951 | 840 | 0 | 0 | 3 |
| Aelgani Varun Goud | 2024 | 2026 | 1010 | 837 | 24 | 30 | 3 |
| Ravi Teja  T | 2024 | 2026 | 1073 | 835 | 45 | 20 | 3 |
| Harshit  Choudhary | 2024 | 2026 | 988 | 812 | 33 | 1 | 3 |
| Anumula Vignesh Reddy | 2024 | 2026 | 961 | 807 | 2 | 0 | 3 |
| GANESH GADUGU | 2024 | 2026 | 895 | 804 | 18 | 3 | 3 |
| Jashwanth Kanneboina | 2024 | 2026 | 1139 | 794 | 15 | 8 | 3 |
| Aman Rao Perala | 2024 | 2026 | 641 | 762 | 1 | 0 | 3 |
| SMYAN BHARADWAJ | 2024 | 2026 | 765 | 753 | 0 | 0 | 3 |
| Shashank Lokesh | 2024 | 2026 | 1294 | 753 | 0 | 0 | 3 |
| Aryan Krishna | 2024 | 2026 | 895 | 750 | 0 | 0 | 3 |
| M Hansin Reddy | 2024 | 2026 | 937 | 745 | 11 | 1 | 3 |

## Analyst Review And Future Planning Framework
### Player review
- **Retain / accelerate:** use only when the player has a High confidence tier and remains productive across at least two observed seasons.
- **Develop:** use when performance is positive but the evidence tier is Limited or the player has only one season; assign a measurable next-season target rather than a selection conclusion.
- **Monitor:** use when the latest season differs sharply from prior output. Validate role, workload, opposition, and match context before intervention.
- **Do not select from this report alone:** a high total without a sufficient opportunity sample, or a missing source feed, is not evidence of superior underlying ability.

### Team review
- Compare win rate, points, run ratio, runs scored, runs conceded, and wickets taken together.
- Investigate teams with strong win rate but weak run ratio, or strong run ratio but weak win rate; these are review signals, not diagnoses.
- Build the next planning cycle around role depth: top-order batting, middle-order conversion, new-ball control, death-overs control, and fielding. Only the batting and bowling portions are currently measurable from this source.

### Recommended next data additions
- Match-by-match scorecards and opposition strength.
- Venue, pitch, weather, toss, and innings context.
- Player workload, availability, injury, age-group, and training data.
- Ball-by-ball phases, fielding events, and video-coded tactical events.
- Selection outcomes and targets to measure whether recommendations improve results.

## Source Failures And Missingness
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/19-2-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/2-33-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/2-53-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/2-55-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/2-65-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/22-445-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/23-597-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/25-101-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/25-21-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/28-482-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/28-483-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/28-484-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/28-486-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/28-488-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/28-490-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/28-492-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/28-493-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/3-143-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/3-151-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/3-159-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/3-168-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/3-178-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/3-185-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/3-186-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/3-187-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/3-190-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/3-196-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/3-220-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/3-228-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/3-229-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/3-235-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/3-241-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/3-242-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/3-243-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/3-245-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/3-247-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/3-253-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/3-263-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/3-266-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/3-268-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/3-269-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/3-274-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/3-276-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/3-277-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/3-289-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/3-291-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/3-292-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/3-296-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/3-297-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/3-299-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/3-302-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/3-304-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/3-305-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/3-307-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/3-313-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/3-319-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/30-96-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/36-2-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/38-563-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/38-564-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/38-565-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/38-570-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/44-597-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/44-598-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/44-teamoverallstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/54-482-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/54-483-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/54-484-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/54-490-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/54-492-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/54-493-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/58-778-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/58-779-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/58-780-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/58-781-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/58-782-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/58-783-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/58-784-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/58-785-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/59-778-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/59-779-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/59-780-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/59-781-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/60-14-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/60-778-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/60-782-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/60-783-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/60-784-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/60-785-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/60-786-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/60-787-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/60-788-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/65-681-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/66-169-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/66-170-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/66-177-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/66-211-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/66-213-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/66-214-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/66-230-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/66-298-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/66-305-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/66-808-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/66-820-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/66-839-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/66-843-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/66-850-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/66-878-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/66-880-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/66-881-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/66-892-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/66-894-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/66-895-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/66-898-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/66-899-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/66-900-playerstats.js: 404 Not Found
- https://hycamcfeeds.s3.ap-south-1.amazonaws.com/feeds/stats/66-901-playerstats.js: 404 Not Found

## Reproducibility
- Database: `hca_analytics.sqlite`
- Builder: `npm run build-database`
- Report generator: `node generate_analyst_report.js`
- Analysis views created in the database: `v_player_season_analysis`, `v_team_season_analysis`.
