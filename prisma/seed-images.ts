// 种子图片数据：全部来自 Wikimedia Commons 的自由许可图片（直链）。
// 生成方式：Commons API（action=query&prop=imageinfo）检索后人工挑选，
// 每张图的 URL 均经 HTTP 200 验证，credit 标注作者、许可与来源；找不到合适图片的条目为数组留空。
// 允许许可见各 credit（CC0 / CC BY / CC BY-SA / 公有领域）。

export interface SeedImage {
  url: string
  credit: string
}

export const SEED_IMAGES: Record<string, SeedImage[]> = {
  'chengdu-lacquer': [
    { url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e5/Lacquerware_scene%2C_2_of_2_-_Sichuan_University_Museum_-_Chengdu%2C_China_-_DSC06164.jpg/1280px-Lacquerware_scene%2C_2_of_2_-_Sichuan_University_Museum_-_Chengdu%2C_China_-_DSC06164.jpg', credit: 'Daderot，公有领域，via Wikimedia Commons' },
    { url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/28/Lacquerware_scene%2C_1_of_2_-_Sichuan_University_Museum_-_Chengdu%2C_China_-_DSC06163.jpg/1280px-Lacquerware_scene%2C_1_of_2_-_Sichuan_University_Museum_-_Chengdu%2C_China_-_DSC06163.jpg', credit: 'Daderot，公有领域，via Wikimedia Commons' },
  ],
  'cizhou': [
    { url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/77/Song_Dynasty_Cizhou_Ware_Porcelain.jpg/1280px-Song_Dynasty_Cizhou_Ware_Porcelain.jpg', credit: 'Gary Todd，CC0，via Wikimedia Commons' },
    { url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c1/Child-shaped_pillow_%28Cizhou_Ware%29.jpg/1280px-Child-shaped_pillow_%28Cizhou_Ware%29.jpg', credit: 'Gerbil，CC BY-SA 3.0，via Wikimedia Commons' },
  ],
  'dehua': [
    { url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0c/Teapot_with_plum_blossom_design%2C_Dehua_ware.JPG/1280px-Teapot_with_plum_blossom_design%2C_Dehua_ware.JPG', credit: 'Mk2010，CC BY-SA 3.0，via Wikimedia Commons' },
    { url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8c/20241025_Porcelain_Censer%2C_Dehua_Kiln%2C_Qing_Dynasty_02.jpg/1280px-20241025_Porcelain_Censer%2C_Dehua_Kiln%2C_Qing_Dynasty_02.jpg', credit: 'Windmemories，CC BY-SA 4.0，via Wikimedia Commons' },
  ],
  'hubi': [
    { url: 'https://upload.wikimedia.org/wikipedia/commons/7/75/Xuan_Brushes_for_Chinese_Brush_painting_and_calligraphy.jpg', credit: 'ink stone，CC BY-SA 2.0，via Wikimedia Commons' },
  ],
  'huimo': [
    { url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ef/Making_the_Hui_Ink-Stick_%289974438966%29.jpg/1280px-Making_the_Hui_Ink-Stick_%289974438966%29.jpg', credit: 'Gary Todd from Xinzheng, China，CC0，via Wikimedia Commons' },
    { url: 'https://upload.wikimedia.org/wikipedia/commons/5/52/Red_presentation_ink_stick_from_China%2C_Qing_dynasty%2C_Honolulu_Academy_of_Arts.JPG', credit: 'Hiart，CC0，via Wikimedia Commons' },
  ],
  'jingdezhen': [
    { url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/48/Qing_Jingdezhen_Porcelain%2C_Yongzheng_Reign_02.jpg/1280px-Qing_Jingdezhen_Porcelain%2C_Yongzheng_Reign_02.jpg', credit: 'Gary Todd，CC0，via Wikimedia Commons' },
  ],
  'jinling': [
    { url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0c/Buddhist_Sutra_Printing_Block_for_2_Pages_of_Text_per_Side_%284_Pages_Total%29_-_Vanderbilt_Fine_Arts_Gallery_-_1992.249.tif/lossy-page1-1280px-Buddhist_Sutra_Printing_Block_for_2_Pages_of_Text_per_Side_%284_Pages_Total%29_-_Vanderbilt_Fine_Arts_Gallery_-_1992.249.tif.jpg', credit: '佚名，公有领域，via Wikimedia Commons' },
  ],
  'kesi': [
    { url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/cb/Kesi_tapestry_with_lotus_scroll_design%2C_China%2C_Qing_dynasty%2C_1700s_AD%2C_flat-weave_brocade_with_silk_and_metallic_threads_-_Portland_Art_Museum_-_Portland%2C_Oregon_-_DSC08474.jpg/1280px-thumbnail.jpg', credit: 'Daderot，公有领域，via Wikimedia Commons' },
    { url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f6/MET_DT4773.jpg/1280px-MET_DT4773.jpg', credit: '佚名，CC0，via Wikimedia Commons' },
  ],
  'li-textile': [
    { url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7d/Art_du_tissage_des_Li.jpg/1280px-Art_du_tissage_des_Li.jpg', credit: 'Popolon，CC BY-SA 4.0，via Wikimedia Commons' },
    { url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0d/Traditional_weaveing_of_the_Li_Ethnic_Group.jpg/1280px-Traditional_weaveing_of_the_Li_Ethnic_Group.jpg', credit: 'Zhou Guanhuai，CC BY-SA 4.0，via Wikimedia Commons' },
  ],
  'longquan-celadon': [
    { url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e6/Song_Longquan_Ware_Celadon_Jar.jpg/1280px-Song_Longquan_Ware_Celadon_Jar.jpg', credit: 'Gary Lee Todd, Ph.D.，CC0，via Wikimedia Commons' },
    { url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/49/Southern_Song_Longquan_Ware_Celadon_Vase_1.jpg/1280px-Southern_Song_Longquan_Ware_Celadon_Vase_1.jpg', credit: 'Gary Lee Todd, Ph.D.，CC0，via Wikimedia Commons' },
  ],
  'luzhou': [
    { url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1a/Baijiu_Produktion_Luzhou_Laojiao.jpg/1280px-Baijiu_Produktion_Luzhou_Laojiao.jpg', credit: 'Xiaomage de，CC BY-SA 4.0，via Wikimedia Commons' },
    { url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6b/Traditioneller_chinesischer_Destillationsapparat_in_der_Brennerei_Luzhou_Laojiao.jpg/1280px-Traditioneller_chinesischer_Destillationsapparat_in_der_Brennerei_Luzhou_Laojiao.jpg', credit: 'Xiaomage de，CC BY-SA 4.0，via Wikimedia Commons' },
  ],
  'moutai': [
    { url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b8/Maotai_-_Kweichow_Moutai_Distillery_China%2C_Flasche_%282%29.jpg/1280px-Maotai_-_Kweichow_Moutai_Distillery_China%2C_Flasche_%282%29.jpg', credit: 'Jula2812，CC BY-SA 4.0，via Wikimedia Commons' },
  ],
  'fenjiu': [
    { url: 'https://upload.wikimedia.org/wikipedia/commons/9/9d/%E5%B1%B1%E8%A5%BF%E6%B1%BE%E9%85%92%E8%8D%A3%E8%8E%B71915%E5%B9%B4%E5%B7%B4%E6%8B%BF%E9%A9%AC%E4%B8%87%E5%9B%BD%E5%8D%9A%E8%A7%88%E4%BC%9A%E7%9A%84%E2%80%9C%E4%B8%80%E7%AD%89%E9%87%91%E8%B4%A8%E5%A4%A7%E5%A5%96%E7%AB%A0%E2%80%9D_%E6%B1%BE%E9%85%92%E5%8D%9A%E7%89%A9%E9%A6%86%E8%97%8F.png', credit: '汾酒集团文化中心，公有领域，via Wikimedia Commons' },
  ],
  'movable-type': [
    { url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f7/Beijing_printing_museum.wooden_movable_types.jpg/1280px-Beijing_printing_museum.wooden_movable_types.jpg', credit: 'Popolon，CC BY-SA 4.0，via Wikimedia Commons' },
  ],
  'scissors': [
    { url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/89/%E5%BC%A0%E5%B0%8F%E6%B3%89%E5%89%AA%E5%88%80.jpg/1280px-%E5%BC%A0%E5%B0%8F%E6%B3%89%E5%89%AA%E5%88%80.jpg', credit: '三猎，CC BY-SA 4.0，via Wikimedia Commons' },
    { url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c7/The_Original_Site_of_Zhang_Xiaoquan_Scissors_Store_2014-11.JPG/1280px-The_Original_Site_of_Zhang_Xiaoquan_Scissors_Store_2014-11.JPG', credit: '猫猫的日记本，CC BY-SA 4.0，via Wikimedia Commons' },
  ],
  'shaoxing-wine': [
    { url: 'https://upload.wikimedia.org/wikipedia/commons/c/c5/ShaoxingwinefromXianHengInn.jpg', credit: 'Janine Cheung，CC BY-SA 2.0，via Wikimedia Commons' },
    { url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1d/Jarred_Shaoxing_wine_at_a_supermarket_in_Beijing_%2820241109164501%29.jpg/1280px-Jarred_Shaoxing_wine_at_a_supermarket_in_Beijing_%2820241109164501%29.jpg', credit: 'N509FZ，CC BY-SA 4.0，via Wikimedia Commons' },
  ],
  'shujin': [
    { url: 'https://upload.wikimedia.org/wikipedia/commons/6/6d/Shu_brocade%2C_Byzantines_or_Central_Asians_drinking_scene.png', credit: '佚名，公有领域，via Wikimedia Commons' },
    { url: 'https://upload.wikimedia.org/wikipedia/commons/8/8c/Shu_brocade%2C_Chengdu_Museum.png', credit: '佚名，公有领域，via Wikimedia Commons' },
  ],
  'vinegar': [
    { url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c3/Chinkiang_vinegar.jpg/1280px-Chinkiang_vinegar.jpg', credit: 'Fumikas Sagisavas，CC0，via Wikimedia Commons' },
  ],
  'woodblock': [
    { url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/16/Yangzhou_Museum_-_woodblock_for_printing_-_CIMG2878.JPG/1280px-Yangzhou_Museum_-_woodblock_for_printing_-_CIMG2878.JPG', credit: 'User:Vmenkov，CC BY-SA 3.0，via Wikimedia Commons' },
    { url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/60/Yangzhou_Museum_-_woodblock_for_printing_-_fragment_-_CIMG2879.JPG/1280px-Yangzhou_Museum_-_woodblock_for_printing_-_fragment_-_CIMG2879.JPG', credit: 'User:Vmenkov，CC BY-SA 3.0，via Wikimedia Commons' },
  ],
  'xuan-paper': [
    { url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/ff/Making_Xuan_Paper_%289974514453%29.jpg/1280px-Making_Xuan_Paper_%289974514453%29.jpg', credit: 'Gary Todd from Xinzheng, China，CC0，via Wikimedia Commons' },
    { url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/cf/Xuan_Paper_%289974330385%29.jpg/1280px-Xuan_Paper_%289974330385%29.jpg', credit: 'Gary Todd from Xinzheng, China，CC0，via Wikimedia Commons' },
  ],
  'yangzhou-lacquer': [
    { url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/89/Yangzhou_lacquer.JPG/1280px-Yangzhou_lacquer.JPG', credit: 'Gisling，CC BY-SA 3.0，via Wikimedia Commons' },
    { url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/fa/Han_Guangling_Tomb_Museum_-_huzi_-_P1120947.JPG/1280px-Han_Guangling_Tomb_Museum_-_huzi_-_P1120947.JPG', credit: 'User:Vmenkov，CC BY-SA 3.0，via Wikimedia Commons' },
  ],
  'yixing': [
    { url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/12/China%2C_Qing_dynasty_-_Yixing_Teapot_-_1995.12_-_Cleveland_Museum_of_Art.tif/lossy-page1-1280px-China%2C_Qing_dynasty_-_Yixing_Teapot_-_1995.12_-_Cleveland_Museum_of_Art.tif.jpg', credit: '佚名，CC0，via Wikimedia Commons' },
    { url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e0/YixingClayTeapotByChenMingyuanOfQingDynasty-TianqingClay.jpg/1280px-YixingClayTeapotByChenMingyuanOfQingDynasty-TianqingClay.jpg', credit: 'Gw2100，CC BY-SA 4.0，via Wikimedia Commons' },
  ],
  'yunjin2': [
    { url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8a/Nanjing_Brocade_Loom.jpg/1280px-Nanjing_Brocade_Loom.jpg', credit: 'KongFu Wang from Beijing, China，CC BY-SA 2.0，via Wikimedia Commons' },
    { url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/52/Drachenrobe-Qianlong.JPG/1280px-Drachenrobe-Qianlong.JPG', credit: 'Dr. Meierhofer，CC BY-SA 3.0，via Wikimedia Commons' },
  ],
}
