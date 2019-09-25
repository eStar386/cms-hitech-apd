import { FormLabel, TextField } from '@cmsgov/design-system-core';
import PropTypes from 'prop-types';
import React, { Fragment } from 'react';
import { useDispatch } from 'react-redux';

import { t } from '../../i18n';
import Choice from '../../components/Choice';
import DollarField from '../../components/DollarField';
import PercentField from '../../components/PercentField';
import Dollars from '../../components/Dollars';

import {
  setKeyPersonCost,
  setKeyPersonEmail,
  setKeyPersonHasCosts,
  setKeyPersonName,
  setKeyPersonPercentTime,
  setKeyPersonRole
} from '../../actions/editApd';

const tRoot = 'apd.stateProfile.keyPersonnel';

const PersonForm = ({
  index,
  item: { costs, email, hasCosts, name, percentTime, position },
  years
}) => {
  const dispatch = useDispatch();

  const handleChange = action => ({ target: { value } }) => {
    dispatch(action(value, index));
  };

  const setHasCosts = newHasCosts => () => {
    dispatch(setKeyPersonHasCosts(newHasCosts, index));
  };

  const setCostForYear = year => ({ target: { value } }) => {
    dispatch(setKeyPersonCost(value, index, year));
  };

  const primary = index === 0;

  const totalCost = Object.values(costs).reduce(
    (sum, value) => sum + +value,
    0
  );

  return (
    <Fragment>
      <h4 className="ds-h4">
        {primary ? 'Primary' : 'Additional'} APD Point of Contact
      </h4>
      <TextField
        autoFocus="true"
        name={`apd-state-profile-pocname${index}`}
        label={t(`${tRoot}.labels.name`)}
        value={name}
        onChange={handleChange(setKeyPersonName)}
      />
      <TextField
        name={`apd-state-profile-pocemail${index}`}
        label={t(`${tRoot}.labels.email`)}
        value={email}
        onChange={handleChange(setKeyPersonEmail)}
      />
      <TextField
        name={`apd-state-profile-pocposition${index}`}
        label={t(`${tRoot}.labels.position`)}
        value={position}
        onChange={handleChange(setKeyPersonRole)}
      />
      <PercentField
        name={`apd-state-profile-pocpercentTime${index}`}
        label={t(`${tRoot}.labels.percentTime`)}
        value={percentTime || 0}
        size="small"
        onChange={handleChange(setKeyPersonPercentTime)}
      />

      <fieldset className="ds-c-fieldset">
        <legend className="ds-c-label">{t(`${tRoot}.labels.hasCosts`)}</legend>
        <Choice
          type="radio"
          name={`apd-state-profile-hascosts-no${index}`}
          value="no"
          checked={!hasCosts}
          onChange={setHasCosts(false)}
        >
          No
        </Choice>
        <Choice
          type="radio"
          name={`apd-state-profile-hascosts-yes${index}`}
          value="yes"
          checked={hasCosts}
          onChange={setHasCosts(true)}
          checkedChildren={
            <div className="ds-c-choice__checkedChild ds-l-form-row">
              {years.map(ffy => (
                <div key={ffy} className="ds-l-col--auto">
                  <DollarField
                    name={`apd-state-profile-costs${index}-fy${ffy}`}
                    label={`FFY ${ffy}`}
                    size="small"
                    value={costs[ffy]}
                    onChange={setCostForYear(ffy)}
                  />
                </div>
              ))}
              <div className="ds-l-col--auto">
                <FormLabel>Total</FormLabel>
                <div className="form--computed-value__input-aligned">
                  <Dollars>{totalCost}</Dollars>
                </div>
              </div>
            </div>
          }
        >
          Yes
        </Choice>
      </fieldset>
    </Fragment>
  );
};
PersonForm.propTypes = {
  index: PropTypes.number.isRequired,
  item: PropTypes.shape({
    costs: PropTypes.object.isRequired,
    email: PropTypes.string.isRequired,
    hasCosts: PropTypes.bool.isRequired,
    name: PropTypes.string.isRequired,
    percentTime: PropTypes.oneOfType([PropTypes.number, PropTypes.string])
      .isRequired,
    position: PropTypes.string.isRequired
  }).isRequired,
  years: PropTypes.array.isRequired
};

export default PersonForm;
