import { Pivot, PivotItem } from "@fluentui/react";
import { AnalysisPanelTabs } from "./AnalysisPanelTabs";

interface Props {
    className: string;
    activeTab: AnalysisPanelTabs;
    onActiveTabChanged: (tab: AnalysisPanelTabs) => void;
    activeCitation: string | undefined;
    citationHeight: string;
}

const pivotItemDisabledStyle = { disabled: true, style: { color: "grey" } };

export const AnalysisPanel = ({ activeTab, activeCitation, citationHeight, className, onActiveTabChanged }: Props) => {
    const isDisabledCitationTab: boolean = !activeCitation;

    return (
        <Pivot
            className={className}
            selectedKey={activeTab}
            onLinkClick={pivotItem => pivotItem && onActiveTabChanged(pivotItem.props.itemKey! as AnalysisPanelTabs)}
        >
            <PivotItem
                itemKey={AnalysisPanelTabs.CitationTab}
                headerText="ドキュメントを閉じる"
                headerButtonProps={isDisabledCitationTab ? pivotItemDisabledStyle : undefined}
            >
                <iframe title="Citation" src={activeCitation} width="100%" height={citationHeight} />
            </PivotItem>
        </Pivot>
    );
};
