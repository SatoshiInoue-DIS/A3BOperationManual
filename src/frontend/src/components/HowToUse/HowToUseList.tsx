import { HowToUse } from "./HowToUse";

import styles from "./HowToUse.module.css";

export type HowToUseModel = {
    text: string;
};

const HOWTOUSES: HowToUseModel[] = [
    { 
        text: "ChatGPTが研修テキストの内容についてあなたの知りたいことを教えてくれます。"
    },
    { 
        text: "知りたい内容をChatGPTと会話をして導き出しましょう。"
    },
    { 
        text: '英語で表現される語句はなるべく英語で入力しましょう\n例)シスコ→Cisco'
    },
    { 
        text: "検索した情報を使ってちょっとした処理を依頼することもできます。\n例)Java基礎 演習問題1.1の答え合わせをして"
    }
];

export const HowToUseList = () => {
    return (
        <div className={styles.howtousesContainer}>
            <ul className={styles.howtousesNavList}>
                {HOWTOUSES.map((x, i) => (
                    <li key={i}>
                        <HowToUse text={x.text} />
                    </li>
                ))}
            </ul>
        </div>
    );
};
