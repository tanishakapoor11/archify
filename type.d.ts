interface AuthState {
    isSignedIn: boolean;
    userName: string | null;
    userId: string | null;
}

interface Material {
    id: string;
    name: string;
    thumbnail: string;
    type: "color" | "texture";
    category: "floor" | "wall" | "furniture";
}

interface DesignItem {
    id: string;
    name?: string | null;
    sourceImage: string;
    sourcePath?: string | null;
    renderedImage?: string | null;
    renderedPath?: string | null;
    publicPath?: string | null;
    timestamp: number;
    ownerId?: string | null;
    sharedBy?: string | null;
    sharedAt?: string | null;
    isPublic?: boolean;
}

interface DesignConfig {
    floor: string;
    walls: string;
    style: string;
}

enum AppStatus {
    IDLE = "IDLE",
    UPLOADING = "UPLOADING",
    PROCESSING = "PROCESSING",
    READY = "READY",
}

type RenderCompletePayload = {
    renderedImage: string;
    renderedPath?: string;
};

type VisualizerLocationState = {
    initialImage?: string;
    initialRender?: string | null;
    ownerId?: string | null;
    name?: string | null;
    sharedBy?: string | null;
};

interface VisualizerProps {
    onBack: () => void;
    initialImage: string | null;
    onRenderComplete?: (payload: RenderCompletePayload) => void;
    onShare?: (image: string) => Promise<void> | void;
    onUnshare?: (image: string) => Promise<void> | void;
    projectName?: string;
    projectId?: string;
    initialRender?: string | null;
    isPublic?: boolean;
    sharedBy?: string | null;
    canUnshare?: boolean;
}

interface UploadProps {
    onComplete: (
        base64File: string,
        fileName?: string,
    ) => Promise<boolean | void> | boolean | void;
    className?: string;
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "primary" | "secondary" | "ghost" | "outline";
    size?: "sm" | "md" | "lg";
    fullWidth?: boolean;
}

interface CardProps {
    children: React.ReactNode;
    className?: string;
    title?: string;
    action?: React.ReactNode;
}

type AuthContext = {
    isSignedIn: boolean;
    userName: string | null;
    userId: string | null;
    refreshAuth: () => Promise<boolean>;
    signIn: () => Promise<boolean>;
    signOut: () => Promise<boolean>;
};

type StageView = "plan" | "compare" | "render";

type ShareAction = "share" | "unshare";
type ShareStatus = "idle" | "saving" | "done";

type ModalProps = {
    isOpen: boolean;
    onClose: () => void;
    labelledBy: string;
    focusKey?: string | number;
    size?: "md" | "wide";
    showClose?: boolean;
    children: React.ReactNode;
};

type ShareModalProps = {
    isOpen: boolean;
    isPublic: boolean;
    status: ShareStatus;
    shareUrl: string;
    error?: string | null;
    onConfirm: () => void;
    onClose: () => void;
};

type ProjectGridProps = {
    projects: DesignItem[];
    isLoading: boolean;
    userId: string | null;
    isSignedIn: boolean;
    onSignIn: () => void;
    /** Cap the number of cards rendered; omit to show all. */
    limit?: number;
};

type HostingConfig = { subdomain: string };
type HostedAsset = { url: string };

interface StoreHostedImageParams {
    hosting: HostingConfig | null;
    url: string;
    projectId: string;
    label: "source" | "rendered";
}

type ProjectVisibility = "private" | "public";

interface CreateProjectParams {
    item: DesignItem;
}

interface SetProjectVisibilityParams {
    id: string;
    visibility: ProjectVisibility;
}

interface Generate3DViewParams {
    sourceImage: string;
    projectId?: string | null;
}