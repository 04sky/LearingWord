module.exports = {
    base: '/LearingWord/',
    author: 'sky',
    title: 'LearnWord',
    description: '专注技术分享，从后端八股到实践',
    theme: 'vdoing',
    themeConfig:{
        nav: [
            {text: "主页", link: "/"      },
            { text: "分类", link: "/categories/" },
            { text: "LearnWord", link: "/home.md"},
            { text: "推荐书籍", link: "/books/"   },
            { text: "公众号", link: "/wechat-official-accounts/"   },
            { text: "关于", link: "/about/" }
        ],
        sidebar: 'structuring',
        social: {
            icons: [
                {
                    iconClass:'icon-youjian',
                    title:'发邮件',
                    link:'mailto:673052752@qq.com',
                },
                {
                    iconClass: 'icon-csdn',
                    title: 'csdn',
                    link: 'https://blog.csdn.net/qq_39410381?type=blog',
                },
                {
                    iconClass: 'icon-github',
                    title: 'github',
                    link: 'https://github.com/04sky',
                },
                {
                    iconClass: 'icon-gitee',
                    title: 'gitee',
                    link: 'https://gitee.com/sikailin',
                }
            ]
        },
    },
    footer: {
        createYear: 2022,
        copyrightInfo: 'LearWord'
    }
}