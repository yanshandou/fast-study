# 先看视频

[![Demo Video](https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251015215209457.png)](https://www.youtube.com/watch?v=OeQb6fTCafo)

# 我是谁?

![](https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251015215405519.png)

# 现有学习 APP 用不习惯

![](https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251015215539892.png)

# 我自己做一个吧...

![](https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251015215555870.png)

# 主要功能

![](https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251015215624239.png)

![](https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251015215720084.png)

# 我还想做...

![](https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251015215736439.png)

# 接下来

![](https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251015223010376.png)

# 🧰 技术栈

- 🌐 **HTML/CSS/JavaScript**（前端页面、卡片以及操作动画、学习行为相关的处理逻辑）
- 📱 **Apicloud**（打包成 Android 应用）
- 🧭 **PHP**（后端接口，向前端提供数据。APP 在不需要获取新的数据以及同步操作的时候，可以离线使用）
- 🗄️ **MySQL**（存储日语资料、知识点熟练程度、学习时长...）
- 🐍 **Python**（批量向数据库添加数据：单词、语法、听力、JLPT 真题... 资料管够）
- 🌿 **Git**（版本控制，即便是个人项目，版本控制也是必须的）
- 🤖 **ChatGPT**（全能编程助手，没有 GPT，就做不出这个项目；或者说，能做出来，但时间会长很多）

# 📖 页面介绍

- index.html

  - **APICloud 框架初始化** - 基于移动端混合开发框架
  - **数据库管理** - 创建和管理本地 SQLite 数据库
  - **推送服务集成** - 集成腾讯推送服务（TPNS）
  - ...

- studyInfo.html

  - **云端同步功能** - 集成本地与云端数据同步逻辑
  - **学习同步信息展示** - 显示学习数据同步过程的日志信息
  - **进度条组件** - 实时显示同步进度和状态文本
  - **窗口生命周期管理** - 监听应用前后台切换事件
  - **页面路由控制** - 自动关闭相关窗口并跳转到分类页面
  - ...

- category.html

  - **分类展示界面** - 显示待复习笔记的分类列表和数量统计
  - **智能分类推荐** - 根据笔记级别和数量推荐重点复习分类
  - **交互式分类选择** - 分类支持单选和复选，有震动及音效反馈
  - **分类管理功能** - 双击分类可进行重命名、删除、升级、降级操作
  - **数据同步对齐** - 页面初始化时自动对齐笔记数据
  - ...

- category-search.html

  - **分类搜索界面** - 提供分类名称的模糊搜索和多关键词 AND 查询
  - **搜索历史管理** - 记录和显示搜索历史，支持点击快速搜索
  - **通配符支持** - 支持 "\*" 通配符显示所有分类
  - **交互式历史记录** - 点击历史记录快速填入，支持长按删除
  - **恢复删除功能** - 误删搜索记录可通过消息提示恢复
  - **渐变背景设计** - 根据搜索次数显示不同颜色的渐变背景
  - ...

- list.html

  - **笔记列表展示** - 分页显示待复习笔记，支持点击选择和状态切换
  - **手势交互控制** - 摇一摇播放音频列表，左右滑动跳转到卡片页面
  - **多选批量操作** - 支持多选笔记进行批量升级/降级处理
  - **音频列表播放器** - 横屏全屏播放器，支持进度条和跳过功能
  - **实时翻译显示** - 点击笔记显示中日文对照翻译
  - **分组播放模式** - 支持 3 次日语 + 1 次中文的分组循环播放
  - ...

- card.html
  - **单卡片学习模式** - 全屏显示单个笔记卡片，支持翻转查看答案
  - **智能复习算法** - 基于艾宾浩斯遗忘曲线的间隔重复复习系统
  - **手势操作控制** - 左右滑动切换卡片，上下滑动调整记忆等级
  - **记忆等级评估** - 6 级记忆等级系统，动态调整复习间隔
  - **进度追踪显示** - 实时显示学习进度和剩余卡片数量
  - **自动保存机制** - 学习记录自动保存到本地数据库
  - **Markdown 渲染** - 支持 Markdown 格式笔记内容的编辑和显示
  - **语音评论功能** - 支持为学习资料添加文本或者语音的笔记
  - ...

# 同步功能

- 支持跨设备同步
- 跑步的时候用手机，自习室里用平板
- 多端数据一致，只同步修改，提升效率

> ⬇️ 下图为同步的逻辑示意图

![](https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251016223249045.png)

# 同步功能触发时机

- 当检测到本地的待复习笔记的 ID 列表和云端不一致时，会触发同步功能，如果检测到一致，则不会触发同步功能。
- 检测时机有以下几种:
  - 1. 打开 APP 的时候
  - 2. 切入后台的时候
  - 3. 切入前台的时候
  - 4. 手动跳转到同步页面的时候

> ⬇️ 打开 APP 的时候触发同步

<img src="https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251018210251020.gif" width="40%" alt="同步触发时机示意图"/>

> ⬇️ 切入后台的时候触发同步

<img src="https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251018210533813.gif" width="40%" alt="打开APP时触发同步示意图"/>

> ⬇️ 切入前台的时候触发同步

<img src="https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251018210646401.gif" width="40%" alt="切入后台时触发同步示意图"/>

> ⬇️ 手动跳转到同步页面(在分类页面，左滑屏幕)

<img src="https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251018210754726.gif" width="40%" alt="切入前台时触发同步示意图"/>

# 同步页面

- 同步页面的主要功能有:
  - 进行同步操作，并显示同步日志
  - 为每个步骤，显示进度条
  - 统计当日学习时长(从凌晨 4 点开始算起，到第二天的凌晨 4 点为一天)
  - 同步开始时上锁，同一时间只能有一个同步操作在进行

> ⬇️ 同步页面动图

<img src="https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251018223743585.gif" width="40%" alt="同步页面示意图"/>

# 分类页面

- 分类页面是默认主页面，APP 初始化之后，会自动跳转到分类页面
- 同步操作完成之后，也会自动跳转到分类页面
- 该页面用于显示笔记分类，以及每个分类下需要复习的笔记数量

> ⬇️ 分类页面示意图

![](https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251020213442633.png)

> ⬇️ 多个分类以列表形式展示，点击切换选中状态，支持复选

<img src="https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251021204408345.gif" width="40%" alt="分类页面复选示意图"/>

> ⬇️ 左滑跳转到列表页面，并显示选中分类下的笔记列表(如果没有选择，和全选逻辑一致)

<img src="https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251021204811560.gif" width="40%" alt="分类页面跳转到列表页面示意图"/>

# 分类的快捷操作

> ⬇️ 双击分类，弹出快捷操作菜单

<img src="https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251021205106841.gif" width="40%" alt="分类快捷操作示意图"/>

- 快捷操作菜单包括: 重命名，删除，升级，降级

> ⬇️ 升级，降级

![](https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251021205556707.png)

> ⬇️ 重命名

![](https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251021210510930.png)

> ⬇️ 删除分类

![](https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251021210651962.png)

# 优先级排序算法

- 想提升记忆的效率，就需要在合适的时间重复合适的次数
- 当学习任务量很大，分类很多的时候，比如有单词资料，有语法资料，有听力资料，有阅读资料...
- 这种情况下，很难人为的判断，当前时间下应该优先复习哪些内容，才能保证记忆效率的最大化
- 此时，就需要程序自动帮你做出选择，对复习的资料进行优先级排序，然后按照优先级顺序进行复习
- 分类页面默认显示的是，当下需要优先复习笔记分类，所以看起来有些少，因为这并不是全部笔记

> ⬇️ 分类优先级排序例图

![](https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251021212628609.png)

- 如果当前想复习别的分类呢? 或者想查看分类下所有笔记怎么办?
- 这个时候需要使用分类搜索页面

# 分类搜索页面

- 分类搜索页面用于搜索分类，可以查询出分类下的所有待复习笔记

> ⬇️ 分类页面长按进入分类搜索页面

<img src="https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251022130603886.gif" width="40%" alt="分类搜索页面示意图"/>

> ⬇️ 分类搜索页面主要包括搜索框以及搜索历史列表

![](https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251022141425205.png)

> ⬇️ 支持通配符 "\*" 显示所有分类

<img src="https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251022142131534.gif" width="40%" alt="分类搜索通配符示意图"/>

> ⬇️ 支持历史记录快速搜索(分类上双击)

<img src="https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251022142337031.gif" width="40%" alt="分类搜索历史记录示意图"/>

> ⬇️ 支持长按历史记录删除(可以恢复)

<img src="https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251022142709445.gif" width="40%" alt="分类搜索历史记录删除示意图"/>

> ⬇️ 分类查询之后，点击消息框跳转到分类页面

<img src="https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251022143021483.gif" width="40%" alt="分类搜索跳转示意图"/>

# 笔记列表页面

> ⬇️ 从分类页面左滑进入笔记列表页面，显示选中分类下的笔记列表

<img src="https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251023143030586.gif" width="40%" alt="分类搜索跳转示意图"/>

> ⬇️ 每次最多显示 50 条笔记，支持分页显示

![](https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251023145109796.png)

- 单击选中，播放音频并显示翻译
- 再次单击，标记为未掌握
- 再次单击，还原为初始状态
- 不同背景色表示不同级别

> ⬇️ 单击笔记示意图

<img src="https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251023151540144.gif" width="40%" alt="笔记列表单击示意图"/>

> ⬇️ 双击显示详情(进入卡片页面)

<img src="https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251023151858123.gif" width="40%" alt="笔记列表双击示意图"/>

# 笔记批量操作

- 支持多选笔记，批量升级/降级笔记
- 高亮的笔记，即标记为已掌握的笔记，统一级别+1
- 有删除线的笔记，即标记为未掌握的笔记，统一级别-1
- 可以快速处理笔记，提升学习效率
- 适用于已经掌握大部分内容，只需要复习少量内容的情况

> ⬇️ 在有笔记被标记的情况下，长按或者摇一摇，可以批量处理笔记

<img src="https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251023153112731.gif" width="40%" alt="笔记批量操作示意图"/>

# 笔记列表播放

- 在没有笔记被标记的情况下，长按或者摇一摇，可以播放音频列表
- 播放模式为分组播放(3 次日语 + 1 次中文)，每组重复 3 次

> ⬇️ 摇一摇/长按唤出播放音频列表示意图(竖屏)

<img src="https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251023160620484.gif" width="40%" alt="笔记列表播放示意图"/>

> ⬇️ 摇一摇/长按唤出播放音频列表示意图(横屏)

<img src="https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251023160743016.gif" width="60%" alt="笔记列表播放示意图横屏"/>

> ⬇️ 播放列表示意图

![](https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251023161651815.png)

> ⬇️ 单击切换播放/暂停，暂停时显示翻译

<img src="https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251023162509223.gif" width="40%" alt="笔记列表播放暂停示意图"/>

> ⬇️ 当前组播放完毕，自动跳到下一组(当前笔记级别-1)

<img src="https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251023163112922.gif" width="40%" alt="笔记列表播放跳转示意图"/>

> ⬇️ 如果已经记住，可双击快速跳转下一组(当前笔记级别+1)

<img src="https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251023163249379.gif" width="40%" alt="笔记列表播放跳转示意图快速跳转"/>

> ⬇️ 长按添加谐音助记(竖屏演示)

<img src="https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251023163708417.gif" width="40%" alt="笔记列表添加谐音助记示意图"/>

> ⬇️ 长按添加谐音助记(横屏演示)

<img src="https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251023163735388.gif" width="60%" alt="笔记列表添加谐音助记示意图横屏"/>

# 卡片页面

- APP 的核心页面，基于记忆卡片进行学习
- 从笔记列表页面切入到卡片页面有三种方式

> ⬇️ 双击笔记列表中的某个笔记

<img src="https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251023151858123.gif" width="40%" alt="笔记列表双击示意图"/>

> ⬇️ 从笔记列表页面左滑进入卡片页面(听力模式)

<img src="https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251024150032717.gif" width="40%" alt="卡片页面听力模式示意图"/>

> ⬇️ 从笔记列表页面右滑进入卡片页面(普通模式)

<img src="https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251024150312943.gif" width="40%" alt="卡片页面普通模式示意图"/>

> ⬇️ 支持多选笔记，进入卡片页面后，只复习选中的笔记

<img src="https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251024162218812.gif" width="40%" alt="卡片页面多选示意图"/>

# 卡片页面界面说明

> ⬇️ 顶部状态栏

![](https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251024151833321.png)

> ⬇️ 单击切换卡片正反面

<img src="https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251024152348811.gif" width="40%" alt="卡片页面切换正反面示意图"/>

> ⬇️ 卡片正面(白色卡片)

![](https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251024153649647.png)

> ⬇️ 卡片反面(白色方格卡片)

![](https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251024160321279.png)

> ⬇️ 卡片底部，卡片背景

![](https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251024160832237.png)

# 卡片操作

- 卡片支持上下左右滑动

> ⬇️ 上滑笔记，表示记忆正确，级别+1(弹框提示下一次复习时间)

<img src="https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251024162741210.gif" width="40%" alt="卡片上滑示意图"/>

> ⬇️ 下滑笔记，表示记忆错误，级别-1(弹框提示下一次复习时间)

<img src="https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251024162859037.gif" width="40%" alt="卡片下滑示意图"/>

> ⬇️ 左滑笔记，切换下一个笔记，右滑笔记，切换上一个笔记(支持循环切换)

<img src="https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251024163458047.gif" width="40%" alt="卡片左右滑动示意图"/>

# 听力模式和普通模式的区别

- 听力模式，适合只用耳朵学习的情况，操作简单，防止误触，是为了跑步或通勤等不方便看屏幕的场景。
- 普通模式，适合用眼睛和耳朵一起学习的情况，操作丰富，支持滚动查看内容，是为了在家或自习室等可以专注看屏幕的场景。

> ⬇️ 从笔记列表页面左滑进入卡片页面(听力模式)

<img src="https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251024150032717.gif" width="40%" alt="卡片页面听力模式示意图"/>

> ⬇️ 从笔记列表页面右滑进入卡片页面(普通模式)

<img src="https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251024150312943.gif" width="40%" alt="卡片页面普通模式示意图"/>

> ⬇️ 普通模式的三种选择

![](https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251025171125123.png)

> ⬇️ 听力模式和普通模式的区别示意图

![](https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251025162539763.png)

# 快捷按钮组

- 普通模式时，位于卡片反面的底部，包含了常用的操作
- 如果没有滚动条，为三联按钮
- 如果有滚动条，为五联按钮
- 听力模式下，为防止误触，不显示快捷按钮组

> ⬇️ 快捷按钮组示意图

![](https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251025164034931.png)

> ⬇️ 删除笔记，支持撤销

<img src="https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251025164952121.gif" width="40%" alt="快捷按钮组删除笔记示意图"/>

> ⬇️ 人工智能，调用的 ChatGPT 接口

<img src="https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251025165227358.gif" width="40%" alt="快捷按钮组人工智能示意图"/>

> ⬇️ 语音笔记，可以录制语音，保存后，会添加在笔记的最后

<img src="https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251025165429881.gif" width="40%" alt="快捷按钮组语音笔记示意图"/>

> ⬇️ 记住笔记，相当于上滑笔记，级别+1

<img src="https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251025170134943.gif" width="40%" alt="快捷按钮组记住笔记示意图"/>

> ⬇️ 忘记笔记，相当于下滑笔记，级别-1

<img src="https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251025170241060.gif" width="40%" alt="快捷按钮组忘记笔记示意图"/>

# 增强按钮组

- 增强按钮组包含所有操作，也包括快捷按钮组的操作

> ⬇️ 长按屏幕唤出增强按钮组

<img src="https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251025170402222.gif" width="40%" alt="增强按钮组示意图"/>

> ⬇️ 增强按钮组功能说明

![](https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251025174807620.png)

> ⬇️ 语音笔记/录音笔记，可以录制语音，保存后，会添加在笔记的最后

<img src="https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251025190520148.gif" width="40%" alt="增强按钮组语音笔记示意图"/>

> ⬇️ 人工智能，调用的 ChatGPT 接口(和快捷按钮组的功能一致，属于 AI 的第二个入口)

<img src="https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251025190650498.gif" width="40%" alt="增强按钮组人工智能示意图"/>

> ⬇️ 文字笔记，可以用于为单词添加谐音助记，马克笔效果高亮显示

<img src="https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251025191148755.gif" width="40%" alt="增强按钮组文字笔记示意图"/>

> ⬇️ 忘记笔记，相当于下滑笔记，级别-1(和快捷按钮组的功能一致)

<img src="https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251025191400492.gif" width="40%" alt="增强按钮组忘记笔记示意图"/>

> ⬇️ 切换振动状态，用于跑步时关闭 shake 监听，防止误触发. shake(摇一摇)功能，用于控制当前音频的播放和暂停

<img src="https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251025192717813.gif" width="40%" alt="增强按钮组切换模式示意图"/>

> ⬇️ 记住笔记，相当于上滑笔记，级别+1(和快捷按钮组的功能一致)

<img src="https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251025192929322.gif" width="40%" alt="增强按钮组记住笔记示意图"/>

> ⬇️ 删除笔记，支持撤销(和快捷按钮组的功能一致)

<img src="https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251025193519418.gif" width="40%" alt="增强按钮组删除笔记示意图"/>

> ⬇️ 发音校准，通过语音识别(STT)技术，把录音转成文字，可以和笔记中的日语文本进行对比(另一个入口是日语文本上长按)

<img src="https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251025193842653.gif" width="40%" alt="增强按钮组发音校准示意图"/>

> ⬇️ 笔记编辑，可以编辑当前笔记的内容，支持 markdown 语法

<img src="https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251025194636431.gif" width="40%" alt="增强按钮组笔记编辑示意图"/>

# 发音校准的两个入口

> ⬇️ 增强按钮组的发音校准按钮

<img src="https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251025193842653.gif" width="40%" alt="增强按钮组发音校准示意图"/>

> ⬇️ 日语文本上长按，触发发音校准功能，支持标记需要关注的发音

<img src="https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251025195213136.gif" width="40%" alt="日语文本发音校准示意图"/>

# 人工智能的三个入口

> ⬇️ 快捷按钮组的 AI 按钮

<img src="https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251025165227358.gif" width="40%" alt="快捷按钮组人工智能示意图"/>

> ⬇️ 增强按钮组的 AI 按钮

<img src="https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251025190650498.gif" width="40%" alt="增强按钮组人工智能示意图"/>

> ⬇️ 日语文本上双击(如果是句子，自动拆解，如果是单词，自动解释)

<img src="https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251025195719360.gif" width="40%" alt="日语文本人工智能示意图"/>

# 调整字体大小

- 连续点击屏幕 7 次，可触发字体大小调整功能
- 使用音量键调整字体大小
- 支持卡片正面和反面独立调整

> ⬇️ 调整字体大小效果图

<img src="https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251025201916223.gif" width="40%" alt="调整字体大小示意图"/>

# 填空模式

> ⬇️ 笔记内容为 markdown 格式，如果内容使用反引号包裹，则表示该部分为填空内容

<img src="https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251025202738013.gif" width="40%" alt="填空模式示意图"/>

> ⬇️ 通过单击，控制显示和隐藏填空内容

<img src="https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251025203913923.gif" width="40%" alt="填空内容显示与隐藏示意图"/>

# 刷题功能

- APP 的功能是展示并操作记忆卡片
- 如果后台制作数据时，使用 JLPT 的题目，则可以实现刷题功能

> ⬇️ JLPT 刷题示意图

<img src="https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251025211313999.gif" width="40%" alt="JLPT 刷题选择答案示意图"/>

# 后期计划

- 进一步提升性能，使操作更加顺畅，达到游戏里那种丝滑连招的效果
- 增加更多交互动画，提升 APP 的使用乐趣，让学习更像游戏
- 增加更多实用功能，比如隔空手势，语音控制，眼动追踪...
  - 隔空手势，可以用在健身房跑步的时候，通过手势来控制 APP 的操作，比如切换卡片，播放音频等
  - 语音控制，通过语音来控制 APP 的操作，定制学习内容，比如遇到熟悉的内容，可以直接说“跳过”，对于不太熟悉的内容，可以说“再播放五次”
  - 眼动追踪，可以用在内容过长，有滚动条的时候，通过识别眼动来自动滚动内容，和隔空手势一样，都是为了适用于不方便触摸屏幕的场景
- 引入更多 AI 技术，增加口语练习功能，包括语法纠正和发音评分
- 添加和智能手表的联动，在人多拥挤的场景，通过手表也可以完成学习过程
- 添加 PC 端的后台数据管理系统，方便批量导入和管理学习资料
- 从单人版本，发展到多人版本，通过 PC 端页面，可以查看大家的学习进度和状态，通过排名可以互相监督和激励
- ...

# 先到这里吧...

![](https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251025222608878.png)

# 联系方式

- 如有需要，随时可撩
- 邮箱: whyanshandou@gmail.com
- 微信: xujunhaodeweixin

> ⬇️ WeChat & Gmail

![](https://tokyo-1253389072.cos.ap-tokyo.myqcloud.com/typora/20251026100728992.png)
