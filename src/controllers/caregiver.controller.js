const caregiverService = require("../services/caregiver.service");

// POST /api/caregivers/invite
// patient invites a caregiver by email
exports.inviteCaregiver = async (req, res, next) => {
  try {
    const profileId = req.profile?.id;
    if (!profileId) {
      return res.status(400).json({
        success: false,
        message: "Active profile required to invite caregiver",
      });
    }

    const result = await caregiverService.inviteCaregiver(
      req.user.id,
      profileId,
      req.body
    );

    res.status(201).json({
      success: true,
      message: "Caregiver invitation sent successfully",
      caregiver: result,
    });
  } catch (err) {
    next(err);
  }
};


// GET /api/caregivers
// patient lists caregivers for current profile
exports.getCaregivers = async (req, res, next) => {
  try {
    const profileId = req.profile?.id;
    if (!profileId) {
      return res.status(400).json({
        success: false,
        message: "Active profile required to fetch caregivers",
      });
    }

    const caregivers = await caregiverService.getCaregiversForProfile(
      req.user.id,
      profileId
    );

    res.status(200).json({
      success: true,
      count: caregivers.length,
      caregivers,
    });
  } catch (err) {
    next(err);
  }
};


// PATCH /api/caregivers/:accessId/permissions
// patient updates permissions for a caregiver
exports.updatePermissions = async (req, res, next) => {
  try {
    const profileId = req.profile?.id;
    const { accessId } = req.params;

    if (!profileId) {
      return res.status(400).json({
        success: false,
        message: "Active profile required to update permissions",
      });
    }

    const result = await caregiverService.updateCaregiverPermissions(
      req.user.id,
      profileId,
      accessId,
      req.body.permissions
    );

    res.status(200).json({
      success: true,
      message: "Caregiver permissions updated successfully",
      caregiver: result,
    });
  } catch (err) {
    next(err);
  }
};


// PATCH /api/caregivers/:accessId/accept
// caregiver accepts invitation
exports.acceptInvitation = async (req, res, next) => {
  try {
    const { accessId } = req.params;

    const result = await caregiverService.acceptCaregiverInvitation(
      req.user.id,
      accessId
    );

    res.status(200).json({
      success: true,
      message: "Caregiver invitation accepted successfully",
      caregiver: result,
    });
  } catch (err) {
    next(err);
  }
};


// PATCH /api/caregivers/:accessId/decline
// caregiver declines invitation
exports.declineInvitation = async (req, res, next) => {
  try {
    const { accessId } = req.params;

    const result = await caregiverService.declineCaregiverInvitation(
      req.user.id,
      accessId
    );

    res.status(200).json({
      success: true,
      message: "Caregiver invitation declined",
      caregiver: result,
    });
  } catch (err) {
    next(err);
  }
};


// DELETE /api/caregivers/:accessId
// patient revokes caregiver access
exports.revokeAccess = async (req, res, next) => {
  try {
    const profileId = req.profile?.id;
    const { accessId } = req.params;

    if (!profileId) {
      return res.status(400).json({
        success: false,
        message: "Active profile required to revoke access",
      });
    }

    const result = await caregiverService.revokeCaregiverAccess(
      req.user.id,
      profileId,
      accessId
    );

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (err) {
    next(err);
  }
};


// GET /api/caregivers/my-patients
// caregiver lists all patients who gave them active access
exports.getMyPatients = async (req, res, next) => {
  try {
    const patients = await caregiverService.getMyPatients(req.user.id);

    res.status(200).json({
      success: true,
      count: patients.length,
      patients,
    });
  } catch (err) {
    next(err);
  }
};


// GET /api/caregivers/patient-data/:profileId
// caregiver views patient summary according to granted permissions
exports.getPatientOverview = async (req, res, next) => {
  try {
    const { profileId } = req.params;

    const data = await caregiverService.getPatientOverviewForCaregiver(
      req.user.id,
      profileId
    );

    res.status(200).json({
      success: true,
      ...data,
    });
  } catch (err) {
    next(err);
  }
};
