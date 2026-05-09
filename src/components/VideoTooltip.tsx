import React from 'react';

interface VideoTooltipProps {
    children: React.ReactNode;
}

export default function VideoTooltip({ children }: VideoTooltipProps) {
    return (
        <span className="video-tooltip">
            {children}
            <span className="tooltip-text">
                Vídeos gerados por AI (máx. 25s). Para durações superiores, consulte-nos para orçamento extra.
            </span>
        </span>
    );
}
