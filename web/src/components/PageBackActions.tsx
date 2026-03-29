import { Link, useNavigate } from "react-router-dom";

type PageBackActionsProps = {
  dashboardTo?: string;
};

export default function PageBackActions({ dashboardTo = "/" }: PageBackActionsProps) {
  const navigate = useNavigate();

  return (
    <div className="back-button-group">
      <button
        type="button"
        className="ghost back-button"
        onClick={() => {
          if (window.history.length > 1) {
            navigate(-1);
            return;
          }
          navigate(dashboardTo);
        }}
      >
        ← Back
      </button>
      <Link className="ghost back-button" to={dashboardTo}>
        ← Back to Dashboard
      </Link>
    </div>
  );
}
