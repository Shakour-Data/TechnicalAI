import pandas as pd
import numpy as np
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tsa.statespace.sarimax import SARIMAX
from statsmodels.tsa.holtwinters import ExponentialSmoothing
from statsmodels.tsa.stattools import adfuller, kpss
from statsmodels.tsa.seasonal import seasonal_decompose
from scipy import stats
import warnings
warnings.filterwarnings('ignore')

class TimeSeriesAnalyzer:
    def __init__(self, data, symbol):
        self.data = data
        self.symbol = symbol
        self.results = {}

    def basic_statistics(self):
        """Calculate basic statistics."""
        returns = self.data['Close'].pct_change().dropna()
        stats_result = {
            'mean': float(self.data['Close'].mean()),
            'std': float(self.data['Close'].std()),
            'min': float(self.data['Close'].min()),
            'max': float(self.data['Close'].max()),
            'median': float(self.data['Close'].median()),
            'skewness': float(stats.skew(returns)),
            'kurtosis': float(stats.kurtosis(returns)),
            'volatility': float(returns.std() * np.sqrt(252)),  # Annualized
            'sharpe_ratio': float(returns.mean() / returns.std() * np.sqrt(252)) if returns.std() != 0 else 0.0,
            'max_drawdown': float((self.data['Close'] / self.data['Close'].cummax() - 1).min()),
            'current_price': float(self.data['Close'].iloc[-1]),
            'price_change_1d': float(self.data['Close'].pct_change(1).iloc[-1]),
            'price_change_7d': float(self.data['Close'].pct_change(7).iloc[-1]),
            'price_change_30d': float(self.data['Close'].pct_change(30).iloc[-1]),
        }
        return stats_result

    def check_stationarity(self, series=None):
        """Check stationarity using ADF and KPSS tests."""
        if series is None:
            series = self.data['Close']
        # ADF Test
        adf_result = adfuller(series.dropna())
        adf_statistic, adf_pvalue, adf_usedlag, adf_nobs, adf_critical, adf_ebest = adf_result
        # KPSS Test
        kpss_result = kpss(series.dropna(), regression='c')
        kpss_statistic, kpss_pvalue, kpss_lag, kpss_critical = kpss_result
        return {
            'adf': {
                'statistic': float(adf_statistic),
                'p_value': float(adf_pvalue),
                'critical_values': {k: float(v) for k, v in adf_critical.items()},
                'is_stationary': adf_pvalue < 0.05
            },
            'kpss': {
                'statistic': float(kpss_statistic),
                'p_value': float(kpss_pvalue),
                'critical_values': {k: float(v) for k, v in kpss_critical.items()},
                'is_stationary': kpss_pvalue > 0.05
            }
        }

    def decompose(self, model='additive', period=None):
        """Decompose time series into trend, seasonal, residual."""
        if period is None:
            # Try to infer period (assuming daily data)
            period = 7  # weekly
        try:
            decomposition = seasonal_decompose(self.data['Close'], model=model, period=period)
            return {
                'trend': decomposition.trend.dropna().tolist(),
                'seasonal': decomposition.seasonal.dropna().tolist(),
                'residual': decomposition.resid.dropna().tolist(),
                'observed': self.data['Close'].dropna().tolist()
            }
        except Exception as e:
            return {'error': str(e)}

    def spectrum_analysis(self):
        """Perform spectral analysis (simplified)."""
        from scipy import signal
        close = self.data['Close'].values
        # Detrend
        close_detrended = signal.detrend(close)
        # Compute power spectral density
        freqs, psd = signal.welch(close_detrended, fs=1.0, nperseg=256)
        # Find dominant frequencies
        peaks, _ = signal.find_peaks(psd, height=np.max(psd)*0.5)
        dominant_freqs = freqs[peaks]
        dominant_periods = 1 / dominant_freqs[dominant_freqs > 0]
        return {
            'frequencies': freqs.tolist(),
            'power_spectral_density': psd.tolist(),
            'dominant_frequencies': dominant_freqs.tolist(),
            'dominant_periods': dominant_periods.tolist()
        }

    def fit_arima(self, order=(1,1,1)):
        """Fit ARIMA model."""
        try:
            series = self.data['Close'].values if hasattr(self.data, 'values') else self.data['Close']
            model = ARIMA(series, order=order)
            fitted = model.fit()
            return fitted
        except Exception as e:
            raise Exception(f"ARIMA fitting failed: {str(e)}")

    def fit_sarima(self, order=(1,1,1), seasonal_order=(1,1,1,12)):
        """Fit SARIMA model."""
        try:
            series = self.data['Close'].values if hasattr(self.data, 'values') else self.data['Close']
            model = SARIMAX(series, order=order, seasonal_order=seasonal_order)
            fitted = model.fit(disp=False)
            return fitted
        except Exception as e:
            raise Exception(f"SARIMA fitting failed: {str(e)}")

    def fit_ets(self, trend='add', seasonal='add', seasonal_periods=12):
        """Fit Exponential Smoothing (ETS) model."""
        try:
            series = self.data['Close'].values if hasattr(self.data, 'values') else self.data['Close']
            model = ExponentialSmoothing(
                series,
                trend=trend,
                seasonal=seasonal,
                seasonal_periods=seasonal_periods
            )
            fitted = model.fit()
            return fitted
        except Exception as e:
            raise Exception(f"ETS fitting failed: {str(e)}")

    def forecast_ets(self, model, steps=30, confidence=0.95):
        """Generate forecast from ETS model."""
        try:
            forecast_values = model.forecast(steps=steps)
            # ETS doesn't have built-in confidence intervals, so use residual-based
            residuals = model.resid
            std_resid = residuals.std() if len(residuals) > 0 else 1.0
            z = 1.96 if confidence == 0.95 else (2.576 if confidence == 0.99 else 1.645)
            margin = std_resid * z
            upper = [v + margin for v in forecast_values]
            lower = [v - margin for v in forecast_values]
            return {
                'forecast': forecast_values.tolist(),
                'lower_bound': lower,
                'upper_bound': upper,
                'confidence_intervals': [[l, u] for l, u in zip(lower, upper)]
            }
        except Exception as e:
            raise Exception(f"ETS forecast failed: {str(e)}")

    def forecast(self, model, steps=30, confidence=0.95):
        """Generate forecast from a fitted model."""
        try:
            forecast_obj = model.get_forecast(steps=steps)
            forecast_df = forecast_obj.conf_int(alpha=1-confidence)
            forecast_values = forecast_obj.predicted_mean
            if hasattr(forecast_df, 'iloc'):
                lower = forecast_df.iloc[:, 0].tolist()
                upper = forecast_df.iloc[:, 1].tolist()
            else:
                lower = forecast_df[:, 0].tolist()
                upper = forecast_df[:, 1].tolist()
            if hasattr(forecast_values, 'tolist'):
                forecast_list = forecast_values.tolist()
            else:
                forecast_list = list(forecast_values)
            return {
                'forecast': forecast_list,
                'lower_bound': lower,
                'upper_bound': upper,
                'confidence_intervals': [[l, u] for l, u in zip(lower, upper)]
            }
        except Exception as e:
            raise Exception(f"Forecast failed: {str(e)}")

    def calculate_metrics(self, model, test_size=0.2):
        """Calculate in-sample metrics."""
        try:
            # Convert to numpy array if needed
            series = self.data['Close'].values if hasattr(self.data, 'values') else self.data['Close']
            # Simple train/test split
            train_size = int(len(series) * (1 - test_size))
            train = series[:train_size]
            test = series[train_size:]
            # Re-fit on train
            if isinstance(model, ARIMA):
                # ARIMA models don't expose seasonal attribute; use default order
                order = model.k_arima_order if hasattr(model, 'k_arima_order') else (1,1,1)
                fitted = ARIMA(train, order=order).fit()
            elif isinstance(model, SARIMAX):
                fitted = SARIMAX(train, order=model.model.order, seasonal_order=model.model.seasonal_order).fit(disp=False)
            else:  # ETS
                trend = getattr(model.model, 'trend', 'add')
                seasonal = getattr(model.model, 'seasonal', None)
                sp = getattr(model.model, 'seasonal_periods', None)
                if seasonal is None:
                    fitted = ExponentialSmoothing(train, trend=trend).fit()
                else:
                    fitted = ExponentialSmoothing(
                        train,
                        trend=trend,
                        seasonal=seasonal,
                        seasonal_periods=sp
                    ).fit()
            # Forecast
            forecast = fitted.forecast(steps=len(test))
            # Calculate metrics
            mae = np.mean(np.abs(test - forecast))
            rmse = np.sqrt(np.mean((test - forecast)**2))
            mape = np.mean(np.abs((test - forecast) / test)) * 100 if np.any(test != 0) else 0
            # R2
            ss_res = np.sum((test - forecast)**2)
            ss_tot = np.sum((test - np.mean(test))**2)
            r2 = 1 - (ss_res / ss_tot) if ss_tot != 0 else 0
            return {
                'mae': float(mae),
                'rmse': float(rmse),
                'mape': float(mape),
                'r2': float(r2)
            }
        except Exception as e:
            return {'mae': None, 'rmse': None, 'mape': None, 'r2': None, 'error': str(e)}

    def analyze(self, forecast_steps=30, confidence=0.95, include_decomposition=False,
                include_stationarity=False, include_spectrum=False, include_regime=False):
        """Run full analysis."""
        results = {}
        # Basic stats
        results['basic_stats'] = self.basic_statistics()
        # Stationarity
        if include_stationarity:
            results['stationarity'] = self.check_stationarity()
        # Decomposition
        if include_decomposition:
            results['decomposition'] = self.decompose()
        # Spectrum
        if include_spectrum:
            results['spectrum'] = self.spectrum_analysis()
        # Regime detection (simplified)
        if include_regime:
            # Placeholder for regime detection
            results['regime_detection'] = {'note': 'Regime detection not fully implemented'}
        # Models
        models = {}
        try:
            # ARIMA
            arima_model = self.fit_arima()
            arima_forecast = self.forecast(arima_model, steps=forecast_steps, confidence=confidence)
            arima_metrics = self.calculate_metrics(arima_model, test_size=0.2)
            models['arima'] = {
                'model': arima_model,
                'forecast': arima_forecast,
                'metrics': arima_metrics
            }
        except Exception as e:
            models['arima'] = {'error': str(e)}
        try:
            # SARIMA
            sarima_model = self.fit_sarima()
            sarima_forecast = self.forecast(sarima_model, steps=forecast_steps, confidence=confidence)
            sarima_metrics = self.calculate_metrics(sarima_model, test_size=0.2)
            models['sarima'] = {
                'model': sarima_model,
                'forecast': sarima_forecast,
                'metrics': sarima_metrics
            }
        except Exception as e:
            models['sarima'] = {'error': str(e)}
        try:
            # ETS
            ets_model = self.fit_ets()
            ets_forecast = self.forecast_ets(ets_model, steps=forecast_steps, confidence=confidence)
            ets_metrics = self.calculate_metrics(ets_model, test_size=0.2)
            models['ets'] = {
                'model': ets_model,
                'forecast': ets_forecast,
                'metrics': ets_metrics
            }
        except Exception as e:
            models['ets'] = {'error': str(e)}
        results['models'] = models
        return results