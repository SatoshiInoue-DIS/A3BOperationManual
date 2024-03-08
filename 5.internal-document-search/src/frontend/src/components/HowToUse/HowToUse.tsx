import React from "react";
import styles from "./HowToUse.module.css";

interface Props {
    text: string;
}

//改行コード(/n)があれば改行させる
const MultiLineBody = ( body: string ) => {
    const texts = body.split('\n').map((item, index) => {
        return (
            <React.Fragment key={index}>
                {item}
            <br />
            </React.Fragment>
        );
    });
    return <div>{texts}</div>;
};

export const HowToUse = ({ text }: Props) => {
    const t = MultiLineBody(text)
    return (
        <div className={styles.howtouse} >
            <p className={styles.howtouseText}>{t}</p>
        </div>
    );
};
