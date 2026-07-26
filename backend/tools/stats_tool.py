import pandas as pd
import numpy as np
from scipy import stats
from typing import Dict, Any, List
import warnings
warnings.filterwarnings("ignore")


class StatsTool:
    """Statistical analysis tool for automated insights."""

    def full_stats(self, data: List[Dict], column: str = None) -> Dict[str, Any]:
        """Compute comprehensive statistics for numeric columns."""
        df = pd.DataFrame(data)
        numeric_cols = df.select_dtypes(include=["number"]).columns.tolist()

        if not numeric_cols:
            return {"error": "No numeric columns found"}

        result = {}

        for col in (([column] if column else numeric_cols)):
            if col not in df.columns:
                continue
            series = df[col].dropna()
            if series.empty:
                continue

            # Basic stats
            desc = series.describe()
            skewness = float(series.skew())
            kurt = float(series.kurtosis())

            # Outlier detection (IQR method)
            q1, q3 = series.quantile(0.25), series.quantile(0.75)
            iqr = q3 - q1
            lower_bound = q1 - 1.5 * iqr
            upper_bound = q3 + 1.5 * iqr
            outliers = series[(series < lower_bound) | (series > upper_bound)]

            # Trend (simple linear regression over index)
            x = np.arange(len(series))
            slope, intercept, r_value, p_value, std_err = stats.linregress(x, series)

            result[col] = {
                "count": int(desc["count"]),
                "mean": round(float(desc["mean"]), 4),
                "std": round(float(desc["std"]), 4),
                "min": round(float(desc["min"]), 4),
                "q25": round(float(desc["25%"]), 4),
                "median": round(float(desc["50%"]), 4),
                "q75": round(float(desc["75%"]), 4),
                "max": round(float(desc["max"]), 4),
                "skewness": round(skewness, 4),
                "kurtosis": round(kurt, 4),
                "outlier_count": int(len(outliers)),
                "outlier_pct": round(len(outliers) / len(series) * 100, 2),
                "trend_slope": round(float(slope), 6),
                "trend_direction": "increasing" if slope > 0 else "decreasing" if slope < 0 else "flat",
                "r_squared": round(float(r_value ** 2), 4),
            }

        return {"success": True, "stats": result}

    def detect_anomalies(self, data: List[Dict], column: str) -> Dict[str, Any]:
        """Detect anomalies using Z-score method."""
        df = pd.DataFrame(data)
        if column not in df.columns:
            return {"error": f"Column '{column}' not found"}

        series = df[column].dropna()
        z_scores = np.abs(stats.zscore(series))
        anomaly_mask = z_scores > 3

        anomalies = df[anomaly_mask].copy()
        anomalies["z_score"] = z_scores[anomaly_mask].values

        return {
            "success": True,
            "anomaly_count": int(anomaly_mask.sum()),
            "total_rows": len(series),
            "anomaly_pct": round(anomaly_mask.sum() / len(series) * 100, 2),
            "anomalies": anomalies.head(20).to_dict(orient="records"),
        }

    def correlation_analysis(self, data: List[Dict]) -> Dict[str, Any]:
        """Compute correlation matrix for numeric columns."""
        df = pd.DataFrame(data)
        numeric_df = df.select_dtypes(include=["number"])
        if numeric_df.shape[1] < 2:
            return {"error": "Need at least 2 numeric columns for correlation"}

        corr = numeric_df.corr().round(4)
        # Find strongest correlations
        corr_pairs = []
        cols = corr.columns.tolist()
        for i in range(len(cols)):
            for j in range(i + 1, len(cols)):
                corr_pairs.append({
                    "col1": cols[i],
                    "col2": cols[j],
                    "correlation": corr.iloc[i, j],
                })
        corr_pairs.sort(key=lambda x: abs(x["correlation"]), reverse=True)

        return {
            "success": True,
            "correlation_matrix": corr.to_dict(),
            "strongest_correlations": corr_pairs[:5],
        }


stats_tool = StatsTool()
