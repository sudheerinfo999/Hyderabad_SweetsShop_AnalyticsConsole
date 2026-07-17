-- Hyderabad / Secunderabad / HMR — master data seed
-- Coordinates are approximate centroids and good enough for area-based MVP.

insert into public.hyderabad_areas (area_name, zone_name, latitude, longitude)
values
  ('Gachibowli',         'West Hyderabad',  17.4399, 78.3489),
  ('Kondapur',           'West Hyderabad',  17.4647, 78.3641),
  ('Madhapur',           'West Hyderabad',  17.4483, 78.3915),
  ('HITEC City',         'West Hyderabad',  17.4485, 78.3760),
  ('Kukatpally',         'West Hyderabad',  17.4849, 78.4138),
  ('KPHB',               'West Hyderabad',  17.4948, 78.3915),
  ('Miyapur',            'West Hyderabad',  17.4969, 78.3582),
  ('Bachupally',         'West Hyderabad',  17.5252, 78.3636),
  ('Pragathi Nagar',     'West Hyderabad',  17.5101, 78.3848),
  ('Chandanagar',        'West Hyderabad',  17.4914, 78.3175),
  ('Lingampally',        'West Hyderabad',  17.4858, 78.3175),
  ('Nallagandla',        'West Hyderabad',  17.4640, 78.3030),
  ('Tellapur',           'West Hyderabad',  17.4646, 78.2718),
  ('Narsingi',           'West Hyderabad',  17.4068, 78.3411),
  ('Kokapet',            'West Hyderabad',  17.4197, 78.3263),
  ('Financial District', 'West Hyderabad',  17.4172, 78.3478),
  ('Manikonda',          'West Hyderabad',  17.4047, 78.3825),
  ('Jubilee Hills',      'Central Hyderabad', 17.4326, 78.4071),
  ('Banjara Hills',      'Central Hyderabad', 17.4156, 78.4347),
  ('Ameerpet',           'Central Hyderabad', 17.4374, 78.4482),
  ('Sanath Nagar',       'Central Hyderabad', 17.4538, 78.4423),
  ('Begumpet',           'Central Hyderabad', 17.4435, 78.4691),
  ('Somajiguda',         'Central Hyderabad', 17.4231, 78.4555),
  ('Punjagutta',         'Central Hyderabad', 17.4256, 78.4503),
  ('Mehdipatnam',        'South Hyderabad',  17.3960, 78.4376),
  ('Attapur',            'South Hyderabad',  17.3743, 78.4313),
  ('Tolichowki',         'South Hyderabad',  17.3934, 78.4061),
  ('Charminar',          'Old City',         17.3616, 78.4747),
  ('LB Nagar',           'East Hyderabad',   17.3457, 78.5494),
  ('Dilsukhnagar',       'East Hyderabad',   17.3687, 78.5247),
  ('Uppal',              'East Hyderabad',   17.4060, 78.5594),
  ('Tarnaka',            'Secunderabad',     17.4262, 78.5337),
  ('Secunderabad',       'Secunderabad',     17.4399, 78.4983),
  ('Malkajgiri',         'Secunderabad',     17.4505, 78.5246),
  ('Alwal',              'Secunderabad',     17.5040, 78.5039),
  ('Kompally',           'North Hyderabad',  17.5396, 78.4853),
  ('Medchal',            'HMR',              17.6253, 78.4814),
  ('Shamshabad',         'HMR',              17.2403, 78.4294),
  ('Patancheru',         'HMR',              17.5328, 78.2649),
  ('Ghatkesar',          'HMR',              17.4434, 78.6824)
on conflict (area_name) do nothing;

-- Sub-areas / colonies / nagars
with area_lookup as (
  select id, area_name from public.hyderabad_areas
)
insert into public.hyderabad_sub_areas (main_area_id, sub_area_name, latitude, longitude)
select a.id, s.sub_area_name, s.latitude, s.longitude
from (values
  ('Gachibowli', 'Telecom Nagar',         17.4452, 78.3530),
  ('Gachibowli', 'DLF Pinnacle',          17.4419, 78.3473),
  ('Gachibowli', 'Indira Nagar',          17.4441, 78.3431),
  ('Kondapur',   'Botanical Garden Road', 17.4609, 78.3593),
  ('Kondapur',   'Gangaram',              17.4690, 78.3672),
  ('Madhapur',   'Ayyappa Society',       17.4490, 78.3878),
  ('Madhapur',   'Hitech City Road',      17.4474, 78.3782),
  ('Kukatpally', 'Y Junction',            17.4892, 78.4031),
  ('Kukatpally', 'Vivekananda Nagar',     17.4824, 78.4115),
  ('KPHB',       'Phase 1',               17.4878, 78.3935),
  ('KPHB',       'Phase 6',               17.4980, 78.3839),
  ('KPHB',       'Phase 9',               17.4943, 78.3892),
  ('Miyapur',    'Allwyn Colony',         17.4928, 78.3650),
  ('Miyapur',    'Hafeezpet',             17.4823, 78.3819),
  ('Bachupally', 'Pragathi Enclave',      17.5239, 78.3683),
  ('Bachupally', 'Nizampet Road',         17.5167, 78.3711),
  ('Pragathi Nagar', 'Phase 1',           17.5089, 78.3859),
  ('Chandanagar', 'BHEL Road',            17.4923, 78.3185),
  ('Lingampally', 'Beeramguda',           17.4953, 78.2939),
  ('Nallagandla', 'Aparna Sarovar',       17.4711, 78.3043),
  ('Tellapur',   'My Home Avatar',        17.4633, 78.2731),
  ('Narsingi',   'Puppalaguda',           17.4015, 78.3559),
  ('Narsingi',   'Hyder Nagar',           17.4068, 78.3392),
  ('Kokapet',    'Neopolis',              17.4143, 78.3203),
  ('Kokapet',    'Khajaguda',             17.4173, 78.3469),
  ('Financial District', 'Nanakramguda',  17.4221, 78.3464),
  ('Manikonda', 'Lanco Hills',            17.4076, 78.3848),
  ('Manikonda', 'Hafeezpet Side',         17.4128, 78.3922),
  ('Jubilee Hills', 'Road No 36',         17.4275, 78.4084),
  ('Jubilee Hills', 'Road No 45',         17.4307, 78.4133),
  ('Banjara Hills', 'Road No 12',         17.4191, 78.4321),
  ('Banjara Hills', 'Road No 3',          17.4218, 78.4438),
  ('Ameerpet', 'SR Nagar',                17.4408, 78.4373),
  ('Sanath Nagar', 'ESI',                 17.4520, 78.4360),
  ('Begumpet', 'Prakash Nagar',           17.4452, 78.4654),
  ('Mehdipatnam', 'Tolichowki Cross',     17.3955, 78.4239),
  ('Attapur', 'Hyderguda',                17.3771, 78.4256),
  ('LB Nagar', 'Sagar Ring Road',         17.3469, 78.5512),
  ('LB Nagar', 'Hayathnagar',             17.3398, 78.5818),
  ('Dilsukhnagar', 'Chaitanyapuri',       17.3683, 78.5266),
  ('Uppal', 'Habsiguda',                  17.4063, 78.5430),
  ('Uppal', 'Ramanthapur',                17.3934, 78.5471),
  ('Tarnaka', 'Mettuguda',                17.4337, 78.5275),
  ('Secunderabad', 'SP Road',             17.4406, 78.4986),
  ('Malkajgiri', 'Defence Colony',        17.4516, 78.5298),
  ('Alwal', 'Bolarum',                    17.5179, 78.5025),
  ('Kompally', 'Sai Krupa',               17.5359, 78.4885),
  ('Medchal', 'Medchal Town',             17.6253, 78.4814),
  ('Shamshabad', 'Airport Road',          17.2403, 78.4294),
  ('Patancheru', 'BHEL',                  17.5219, 78.2733),
  ('Ghatkesar', 'Pocharam',               17.4271, 78.6373)
) as s(area_name, sub_area_name, latitude, longitude)
join area_lookup a on a.area_name = s.area_name
on conflict (main_area_id, sub_area_name) do nothing;

-- Seed two example branches (admin can edit later).
insert into public.shop_branches (branch_name, address, main_area, latitude, longitude)
values
  ('Hyderabad Sweets — Kukatpally',   'Plot 21, KPHB Main Road, Kukatpally, Hyderabad', 'Kukatpally',   17.4849, 78.4138),
  ('Hyderabad Sweets — Banjara Hills', 'Road No 12, Banjara Hills, Hyderabad',           'Banjara Hills', 17.4191, 78.4321)
on conflict (branch_name) do nothing;
