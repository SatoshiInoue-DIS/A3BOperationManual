import styles from "./nopermission.module.css";
import SingOutButton from "../../components/SignOutButton/SignOutButton";

const NoPermission = () => {
    return (
        <div className={styles.notice_container}>
            <div className={styles.nopermission_notice}>
                <p>あなたはこのアプリを操作する権限がありません。</p>
            </div>
            <div className={styles.back_btn}>
                <SingOutButton></SingOutButton>
            </div>
        </div>
    );
};

export default NoPermission;