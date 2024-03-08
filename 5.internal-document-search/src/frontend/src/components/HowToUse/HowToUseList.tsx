import { HowToUse } from "./HowToUse";

import styles from "./HowToUse.module.css";

export type HowToUseModel = {
    text: string;
};

const HOWTOUSES: HowToUseModel[] = [
    { 
        text: "ChatGPTはあなたの知りたいことを教えてくれますが、研修テキスト内のことに限ります。"
    },
    { 
        text: "検索したい内容を引き出すための検索語句を質問文の中に含ませましょう。"
    },
    { 
        text: '英語で表現される語句はなるべく英語で入力しましょう\n例)シスコ→Cisco'
    },
    { 
        text: "検索した情報を使って何か処理を要求してみましょう。\n例)Java基礎 演習問題1.1の答え合わせをして"
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
